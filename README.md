# meta transaction library

This library is used when using meta-transactions.
Please feel free to use at your own risk.

## how to use

Execute the following command to install.

```bash
yarn add @dea-sg/meta-tx
or
npm install @dea-sg/meta-tx
```

Inheriting ERC2771ContextAccessControlUpgradeable changes the function of the \_msgSender of the contract executed from the metatransaction and changes the sender to the intended one.

```
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@dea-sg/meta-tx/contracts/context/ERC2771ContextAccessControlUpgradeable.sol";

contract ExampleToken is
	ERC20Upgradeable,
	ERC2771ContextAccessControlUpgradeable
{
	bytes public currentData;
	function initialize() public initializer {
		__ERC20_init("token", "TOKEN");
		__ERC2771ContextAccessControl_init();
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
}
```

After deploying, do not forget to register the forwarder that will execute the meta-transaction.

```
const forwarderRole = await example.FORWARDER_ROLE()
await example.grantRole(forwarderRole, forwarder.address)
```

## For Developers

The development environment can be created by executing the following commands.

```bash
yarn
yarn build
yarn test
```
