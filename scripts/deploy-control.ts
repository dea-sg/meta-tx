/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers, upgrades } from 'hardhat'

// Signerが変わればupdateできないことをテストすること！
async function main() {
	const controlFactory = await ethers.getContractFactory(
		'ForwarderAccessControlUpgradeable'
	)
	const control = await upgrades.deployProxy(controlFactory, [], {
		kind: 'uups',
	})
	await control.deployed()
	console.log('proxy was deployed to:', control.address)
	const filter = control.filters.Upgraded()
	const events = await control.queryFilter(filter)
	console.log('logic was deployed to:', events[0].args!.implementation)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
