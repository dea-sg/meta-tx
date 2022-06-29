// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

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
	mapping(address => uint256) private nonces;

	bytes32 public constant EXECUTE_ROLE = keccak256("EXECUTE_ROLE");
	bool private lock = false;
	bool private batchLock = false;

	modifier onlyExecuter() {
		if (batchLock) {
			if (_msgSender() == address(this)) {
				return;
			}
		}
		_checkRole(EXECUTE_ROLE);
		_;
	}

	function initialize(string memory _name, string memory _version)
		public
		initializer
	{
		__EIP712_init_unchained(_name, _version);
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

	function getNonce(address _from) public view returns (uint256) {
		return nonces[_from];
	}

	function verify(ForwardRequest calldata _req, bytes calldata _signature)
		public
		view
		returns (bool)
	{
		// EIP712
		address signer = _hashTypedDataV4(makeHashFromParam(_req)).recover(
			_signature
		);
		// solhint-disable-next-line not-rely-on-time
		require(block.timestamp < _req.expiry, "expired"); //EIP-1681
		return nonces[_req.from] == _req.nonce && signer == _req.from;
	}

	function makeHashFromParam(ForwardRequest calldata _req)
		private
		pure
		returns (bytes32)
	{
		return
			keccak256(
				abi.encode(
					_TYPEHASH,
					_req.from,
					_req.to,
					_req.value,
					_req.gas,
					_req.nonce,
					_req.expiry,
					keccak256(_req.data)
				)
			);
	}

	function execute(ForwardRequest calldata _req, bytes calldata _signature)
		public
		payable
		onlyExecuter
		returns (bool _success, bytes memory _returndata)
	{
		require(!lock, "in progress");
		lock = true;
		(_success, _returndata) = innerExecute(_req, _signature);
		lock = false;
		return (_success, _returndata);
	}

	function innerExecute(
		ForwardRequest calldata _req,
		bytes calldata _signature
	) private returns (bool _success, bytes memory _returndata) {
		require(verify(_req, _signature), "signature does not match request");
		nonces[_req.from] = _req.nonce + 1;
		// solhint-disable-next-line avoid-low-level-calls
		(_success, _returndata) = _req.to.call{
			gas: _req.gas,
			value: _req.value
		}(abi.encodePacked(_req.data, _req.from));
		require(_success, "call error");
		// Validate that the relayer has sent enough gas for the call.
		// See https://ronan.eth.link/blog/ethereum-gas-dangers/
		// EIP-150
		if (gasleft() <= _req.gas / 63) {
			// EIP-1930?
			// We explicitly trigger invalid opcode to consume all gas and bubble-up the effects, since
			// neither revert or assert consume all gas since Solidity 0.8.0
			// https://docs.soliditylang.org/en/v0.8.0/control-structures.html#panic-via-assert-and-error-via-require
			// solhint-disable-next-line no-inline-assembly
			assembly {
				invalid()
			}
		}
		emit MetaTransaction(
			_req.from,
			_req.nonce,
			_req,
			_success,
			_returndata
		);
		return (_success, _returndata);
	}

	function batch(
		ForwardRequest[] calldata _reqs,
		bytes[] calldata _signatures
	) public payable {
		require(msg.sender == address(this), "inner execute only");
		require(_reqs.length == _signatures.length, "illegal params");
		require(batchLock == false, "batch processing");
		batchLock = true;
		for (uint256 i = 0; i < _reqs.length; i++) {
			innerExecute(_reqs[i], _signatures[i]);
		}
		batchLock = false;
	}

	/**
	 * @dev This empty reserved space is put in place to allow future versions to add new
	 * variables without shifting down storage in the inheritance chain.
	 * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
	 */
	uint256[49] private __gap;
}
