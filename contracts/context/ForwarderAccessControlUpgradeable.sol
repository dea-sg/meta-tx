// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IForwarderAccessControlUpgradeable.sol";

contract ForwarderAccessControlUpgradeable is
	AccessControlUpgradeable,
	IForwarderAccessControlUpgradeable
{
	bytes32 public constant FORWARDER_ROLE = keccak256("FORWARDER_ROLE");

	function initialize() public initializer {
		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
	}

	function isTrustedForwarder(address forwarder)
		external
		view
		returns (bool)
	{
		return hasRole(FORWARDER_ROLE, forwarder);
	}
}
