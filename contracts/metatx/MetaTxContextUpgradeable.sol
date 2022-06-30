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
	address public control;

	// solhint-disable-next-line func-name-mixedcase
	function __MetaTxContext_init(address _control) internal onlyInitializing {
		__Context_init();
		control = _control;
	}

	function setForwarderAccessControl(address _control) internal {
		control = _control;
	}

	function isTrustedForwarder(address _forwarder) public view returns (bool) {
		return
			IForwarderAccessControlUpgradeable(control).isTrustedForwarder(
				_forwarder
			);
	}

	function _msgSender()
		internal
		view
		virtual
		override
		returns (address _sender)
	{
		if (isTrustedForwarder(msg.sender)) {
			// solhint-disable-next-line no-inline-assembly
			assembly {
				_sender := shr(96, calldataload(sub(calldatasize(), 20)))
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
