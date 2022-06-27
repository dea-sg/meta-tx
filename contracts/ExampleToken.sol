// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract ExampleToken is OwnableUpgradeable, UUPSUpgradeable, ERC20Upgradeable {
	function initialize() public initializer {
		__Ownable_init();
		__UUPSUpgradeable_init();
		__ERC20_init("token", "TOKEN");
	}

	function _authorizeUpgrade(address) internal override onlyOwner {}
}
