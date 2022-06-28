// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "../metatx/MetaTxContextUpgradeable.sol";

contract MinimalMetaTxContextUpgradeable is MetaTxContextUpgradeable {
	function initialize(address _forwarderAccessControl) public initializer {
		__MetaTxContext_init(_forwarderAccessControl);
	}

	function getMsgSender() external view returns (address sender) {
		return _msgSender();
	}

	function getMsgData() external view returns (bytes calldata) {
		return _msgData();
	}

	function setForwarderAccessControlTest(address _forwarderAccessControl)
		external
	{
		setForwarderAccessControl(_forwarderAccessControl);
	}
}
