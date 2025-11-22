// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/RailaModule.sol";

contract DeployRaila is Script {
    function run() external {
        vm.startBroadcast();

        new RailaModule(
            // wxdai
            IERC20(0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d),
            ICirclesHub(0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8)
        );

        vm.stopBroadcast();
    }
}
