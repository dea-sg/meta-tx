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

After deploying ForwarderAccessControlUpgradeable with proxy(uups), the deployer should execute the following function.
Set the forwarder address to the address of the contract executing the metatransaction.

```
await control.initialize()
const forwarderRole = await control.FORWARDER_ROLE()
await control.grantRole(forwarderRole, {forwarder address})
const hasRole = await control.isTrustedForwarder(foo.address)
console.log(hasRole)
>> True
```

Inheriting MetaTxContextUpgradeable changes the function of the \_msgSender of the contract executed from the metatransaction and changes the sender to the intended one.
The ForwarderAccessControl address must be set in initialize.

```
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@dea-sg/meta-tx/contracts/context/MetaTxContextUpgradeable.sol";

contract ExampleToken is
	ERC20Upgradeable,
	MetaTxContextUpgradeable
{
	bytes public currentData;
	function initialize(address _forwarder) public initializer {
		__ERC20_init("token", "TOKEN");
		__MetaTxContextUpgradeable_init(_forwarder);
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
}
```

After deploying, do not forget to execute initialize function.

```
await example.initialize(forwarder.address)
```

Deploy a contract (ForwarderUpgradeable) that executes the metatransaction.
Execute initialize and set the name and version.
The name and version are required for EIP712 authentication.
You can see how to execute the metatransaction in forward.ts.

## For Developers

The development environment can be created by executing the following commands.

```bash
yarn
yarn build
yarn test
```
