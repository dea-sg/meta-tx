// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "../interfaces/IForwarderAccessControlUpgradeable.sol";

/**
 * @dev Context variant with ERC2771 support.
 */
abstract contract MetaTxContextUpgradeable is
	Initializable,
	ContextUpgradeable
{
	address public forwarderAccessControl;

	// solhint-disable-next-line func-name-mixedcase
	function __MetaTxContextUpgradeable_init(address _forwarderAccessControl)
		internal
		onlyInitializing
	{
		__Context_init();
		forwarderAccessControl = _forwarderAccessControl;
	}

	function setForwarderAccessControl(address _forwarderAccessControl)
		internal
	{
		forwarderAccessControl = _forwarderAccessControl;
	}

	function isTrustedForwarder(address _forwarder) public view returns (bool) {
		return
			IForwarderAccessControlUpgradeable(forwarderAccessControl)
				.isTrustedForwarder(_forwarder);
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
