import { ethers, upgrades } from 'hardhat'

async function main() {
	const controlFactory = await ethers.getContractFactory(
		'ForwarderAccessControlUpgradeableTest2'
	)
	const upgraded = await upgrades.upgradeProxy(
		'0xb1d500041dB4311B811895c51407957c749b202A',
		controlFactory
	)
	console.log('proxy was deployed to:', upgraded.address)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

// Memo
// npx hardhat run dist/scripts/update-control.js --network polygonMumbai
// npx hardhat verify --contract contracts/test/ForwarderAccessControlUpgradeableTest.sol:ForwarderAccessControlUpgradeableTest --network polygonMumbai 0xb1d500041dB4311B811895c51407957c749b202A
