// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

/**
 * @dev Simple minimal forwarder to be used together with an ERC2771 compatible contract. See {ERC2771Context}.
 */
contract ForwarderUpgradeable is
	Initializable,
	EIP712Upgradeable,
	AccessControlEnumerableUpgradeable
{
	using ECDSAUpgradeable for bytes32;
	struct ForwardRequest {
		address from;
		address to;
		uint256 value;
		uint256 gas;
		uint256 nonce;
		uint256 expiry;
		bytes data;
	}
	event MetaTransaction(
		address indexed from,
		uint256 indexed nonce,
		ForwardRequest req,
		bool success,
		bytes returnData
	);
	bytes32 private constant _TYPEHASH =
		keccak256(
			abi.encodePacked(
				"ForwardRequest(",
				"address from,",
				"address to,",
				"uint256 value,",
				"uint256 gas,",
				"uint256 nonce,",
				"uint256 expiry,",
				"bytes data",
				")"
			)
		);
	mapping(address => uint256) private _nonces;

	bytes32 public constant EXECUTE_ROLE = keccak256("EXECUTE_ROLE");
	bool private lock = false;
	bool private isBatchProcessing = false;

	function initialize(string memory name, string memory version)
		public
		initializer
	{
		__EIP712_init_unchained(name, version);
		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
	}

	function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
		uint256 cnt = getRoleMemberCount(EXECUTE_ROLE);
		for (uint256 i = 0; i < cnt; i++) {
			address account = getRoleMember(EXECUTE_ROLE, i);
			revokeRole(EXECUTE_ROLE, account);
		}
		cnt = getRoleMemberCount(EXECUTE_ROLE);
		require(cnt == 0, "not pause");
	}

	function getNonce(address from) public view returns (uint256) {
		return _nonces[from];
	}

	// If executed from a contract, it must correspond to ERC1271 and ERC1654
	// example)
	// if (callData.signatureType == SignatureType.EIP1271) {
	//     require(
	//         ERC1271(callData.from).isValidSignature(dataToHash, callData.signature) == ERC1271_MAGICVALUE,
	//         "invalid 1271 signature"
	//     );
	// } else if(callData.signatureType == SignatureType.EIP1654){
	//     require(
	//         ERC1654(callData.from).isValidSignature(keccak256(dataToHash), callData.signature) == ERC1654_MAGICVALUE,
	//         "invalid 1654 signature"
	//     );
	// } else {
	//     address signer = SigUtil.recover(keccak256(dataToHash), callData.signature);
	//     require(signer == callData.from, "signer != from");
	// }
	function verify(ForwardRequest calldata req, bytes calldata signature)
		public
		view
		returns (bool)
	{
		address signer = _hashTypedDataV4(makeHashFromParam(req)).recover(
			signature
		);
		// solhint-disable-next-line not-rely-on-time
		require(block.timestamp < req.expiry, "expired"); //EIPなんとか
		return _nonces[req.from] == req.nonce && signer == req.from;
	}

	function makeHashFromParam(ForwardRequest calldata req)
		private
		pure
		returns (bytes32)
	{
		return
			keccak256(
				abi.encode(
					_TYPEHASH,
					req.from,
					req.to,
					req.value,
					req.gas,
					req.nonce,
					req.expiry,
					keccak256(req.data)
				)
			);
	}

	function execute(ForwardRequest calldata req, bytes calldata signature)
		public
		payable
		onlyRole(EXECUTE_ROLE)
		returns (bool, bytes memory)
	{
		require(!isLocked(), "in progress");
		lock = true;
		require(verify(req, signature), "signature does not match request");
		_nonces[req.from] = req.nonce + 1;
		// solhint-disable-next-line avoid-low-level-calls
		(bool success, bytes memory returndata) = req.to.call{
			gas: req.gas,
			value: req.value
		}(abi.encodePacked(req.data, req.from));
		require(success, "call error");
		// Validate that the relayer has sent enough gas for the call.
		// See https://ronan.eth.link/blog/ethereum-gas-dangers/
		if (gasleft() <= req.gas / 63) {
			// We explicitly trigger invalid opcode to consume all gas and bubble-up the effects, since
			// neither revert or assert consume all gas since Solidity 0.8.0
			// https://docs.soliditylang.org/en/v0.8.0/control-structures.html#panic-via-assert-and-error-via-require
			// solhint-disable-next-line no-inline-assembly
			assembly {
				invalid()
			}
		}
		emit MetaTransaction(req.from, req.nonce, req, success, returndata);
		lock = false;
		return (success, returndata);
	}

	function isLocked() private view returns (bool) {
		if (isBatchProcessing) {
			return false;
		}
		return lock;
	}

	function batch(ForwardRequest[] calldata reqs, bytes[] calldata signatures)
		public
		payable
	{
		require(msg.sender == address(this), "inner execute only");
		require(reqs.length == signatures.length, "illegal params");
		isBatchProcessing = true;
		// 外から不正に実行されないかチェックする
		for (uint256 i = 0; i < reqs.length; i++) {
			execute(reqs[i], signatures[i]);
		}
		isBatchProcessing = false;
	}

	/**
	 * @dev This empty reserved space is put in place to allow future versions to add new
	 * variables without shifting down storage in the inheritance chain.
	 * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
	 */
	uint256[49] private __gap;
}
