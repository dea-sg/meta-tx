// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "../metatx/MetaTxContextUpgradeable.sol";

contract TestTarget is MetaTxContextUpgradeable {
	address public beforeSender;
	address public arg1;
	address public arg2;
	uint256 public arg3;

	function initialize(address _forwarderAccessControl) public initializer {
		__MetaTxContext_init(_forwarderAccessControl);
	}

	function testFunc(
		address _arg1,
		address _arg2,
		uint256 _arg3
	) external {
		beforeSender = _msgSender();
		arg1 = _arg1;
		arg2 = _arg2;
		arg3 = _arg3;
	}
}
