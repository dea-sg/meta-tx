// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @dev Context variant with ERC2771 support.
 */
abstract contract ERC2771ContextAccessControlUpgradeable is
	AccessControlUpgradeable
{
	bytes32 public constant FORWARDER_ROLE = keccak256("FORWARDER_ROLE");

	// solhint-disable-next-line func-name-mixedcase
	function __ERC2771ContextAccessControl_init() internal onlyInitializing {
		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
	}

	function isTrustedForwarder(address forwarder) public view returns (bool) {
		return hasRole(FORWARDER_ROLE, forwarder);
	}

	function _msgSender()
		internal
		view
		virtual
		override
		returns (address sender)
	{
		if (isTrustedForwarder(msg.sender)) {
			// solhint-disable-next-line no-inline-assembly
			assembly {
				sender := shr(96, calldataload(sub(calldatasize(), 20)))
			}
		} else {
			return super._msgSender();
		}
	}

	function _msgData()
		internal
		view
		virtual
		override
		returns (bytes calldata)
	{
		if (isTrustedForwarder(msg.sender)) {
			return msg.data[:msg.data.length - 20];
		} else {
			return super._msgData();
		}
	}

	/**
	 * @dev This empty reserved space is put in place to allow future versions to add new
	 * variables without shifting down storage in the inheritance chain.
	 * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
	 */
	uint256[50] private __gap;
}
