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

// Memo
// npx hardhat run dist/scripts/deploy-control.js --network polygonMumbai
// npx hardhat verify --contract contracts/access/ForwarderAccessControlUpgradeable.sol:ForwarderAccessControlUpgradeable --network polygonMumbai 0x0a31115725a4a91643191bdf2aD3F1AAe3636351
// proxy was deployed to: 0xb1d500041dB4311B811895c51407957c749b202A
// logic was deployed to: 0x0a31115725a4a91643191bdf2aD3F1AAe3636351
