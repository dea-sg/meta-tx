//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract TestPermitERC20 is ERC20Permit {
	constructor() ERC20("test", "TEST") ERC20Permit("TEST Coin") {
		_mint(msg.sender, 1000000000000000000000);
	}
}
