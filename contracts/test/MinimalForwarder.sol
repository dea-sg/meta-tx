// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.9;

contract MinimalForwarder {
	function execute(
		address _to,
		bytes calldata _data,
		address _from
	) public {
		// solhint-disable-next-line avoid-low-level-calls
		(bool success, ) = _to.call(abi.encodePacked(_data, _from));
		require(success, "call error");
	}
}
