// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../context/ERC2771ContextAccessControlUpgradeable.sol";

contract ExampleToken is
	ERC20Upgradeable,
	ERC2771ContextAccessControlUpgradeable
{
	bytes public currentData;

	function initialize() public initializer {
		__ERC20_init("token", "TOKEN");
		__ERC2771ContextAccessControl_init();
		_mint(msg.sender, 100000000000000000000);
	}

	function _msgSender()
		internal
		view
		override(ContextUpgradeable, ERC2771ContextAccessControlUpgradeable)
		returns (address sender)
	{
		return ERC2771ContextAccessControlUpgradeable._msgSender();
	}

	function _msgData()
		internal
		view
		override(ContextUpgradeable, ERC2771ContextAccessControlUpgradeable)
		returns (bytes memory)
	{
		return ERC2771ContextAccessControlUpgradeable._msgData();
	}

	function getMsgData() external view returns (bytes memory) {
		return _msgData();
	}

	function saveCurrentMsgData() external {
		currentData = _msgData();
	}
}
