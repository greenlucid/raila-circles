// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Enum} from "safe-contracts/contracts/libraries/Enum.sol";

contract RailaModule {
    struct UserLimits {
        uint256 lendingCap;
        uint256 minLendIR;
        // Borrowing settings only make sense for autoborrow (right?)
        uint256 borrowCap;
        uint256 maxBorrowIR; // 0 for "not a relayer"
        uint256 minIRMargin;
    }

    struct UserBalance {
        uint256 lent;
        uint256 owedPerSecond;
        uint256 borrowed;
        uint256 owesPerSecond;
        uint256 timestamp;
    }

    struct Loan {
        uint256 amount;
        // This is a demo, so for borrowing on an already existing loan,
        // just overwrite IR with the latest one.
        // More sense to ID the loans, maybe?
        uint256 interestRatePerSecond;
        uint256 timestamp;
    }

    mapping(address => UserLimits) public limits;
    mapping(address => UserBalance) public balances;
    // loans[lender][borrower]
    mapping(address => mapping(address => Loan)) public loans;

    function setSettings(UserLimits memory _limits) external {
        // TODO
    }

    function borrow(uint256 amount, address[] calldata path, uint256[] calldata irs) external {
        // TODO
    }

    function repay(/* params */) external {
        // TODO
    }

    function updateLoan(/* params */) external {
        // TODO
    }
}
