// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

interface IForwarderAccessControlUpgradeable {
	function isTrustedForwarder(address _forwarder)
		external
		view
		returns (bool);
}
