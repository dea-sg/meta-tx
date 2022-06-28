// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IForwarderAccessControlUpgradeable.sol";

contract ForwarderAccessControlUpgradeable is
	UUPSUpgradeable,
	AccessControlEnumerableUpgradeable,
	IForwarderAccessControlUpgradeable
{
	bytes32 public constant FORWARDER_ROLE = keccak256("FORWARDER_ROLE");

	function initialize() public initializer {
		__UUPSUpgradeable_init();
		__AccessControlEnumerable_init();
		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
	}

	function isTrustedForwarder(address _forwarder)
		external
		view
		returns (bool)
	{
		return hasRole(FORWARDER_ROLE, _forwarder);
	}

	function _authorizeUpgrade(address)
		internal
		override
		onlyRole(DEFAULT_ADMIN_ROLE)
	{}
}
