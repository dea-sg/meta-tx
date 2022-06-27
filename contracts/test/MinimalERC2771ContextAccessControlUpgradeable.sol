// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "../context/ERC2771ContextAccessControlUpgradeable.sol";

contract MinimalERC2771ContextAccessControlUpgradeable is
	ERC2771ContextAccessControlUpgradeable
{
	function initialize() public initializer {
		__ERC2771ContextAccessControl_init();
	}

	function getMsgSender() external view returns (address sender) {
		return _msgSender();
	}

	function getMsgData() external view returns (bytes calldata) {
		return _msgData();
	}
}
