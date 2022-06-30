// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../metatx/MetaTxContextUpgradeable.sol";

contract ExampleToken is ERC20Upgradeable, MetaTxContextUpgradeable {
	bytes public currentData;

	function initialize(address _control) public initializer {
		__ERC20_init("token", "TOKEN");
		__MetaTxContext_init(_control);
		_mint(msg.sender, 100000000000000000000);
	}

	function _msgSender()
		internal
		view
		override(ContextUpgradeable, MetaTxContextUpgradeable)
		returns (address sender)
	{
		return MetaTxContextUpgradeable._msgSender();
	}

	function _msgData()
		internal
		view
		override(ContextUpgradeable, MetaTxContextUpgradeable)
		returns (bytes memory)
	{
		return MetaTxContextUpgradeable._msgData();
	}

	function getMsgData() external view returns (bytes memory) {
		return _msgData();
	}

	function saveCurrentMsgData() external {
		currentData = _msgData();
	}
}
