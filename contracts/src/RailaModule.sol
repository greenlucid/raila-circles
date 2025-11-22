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
        // borrowing on an already existing loan will
        // mutate the borrow to the weighted average
        // of the existing amount, and the borrowed amount
        uint256 interestRatePerSecond;
        uint256 timestamp;
    }

    mapping(address => UserLimits) public limits;
    mapping(address => UserBalance) public balances;
    // loans[lender][borrower]
    mapping(address => mapping(address => Loan)) public loans;

    function setSettings(UserLimits memory _limits) external {
        limits[msg.sender] = _limits;
    }

    function borrow(
        uint256 amount,
        address[] calldata path,
        uint256[] calldata irs
    ) external {
        // TODO
    }

    function repay(
        uint256 amount,
        address[] calldata path
    ) external {
        // TODO
    }

    function updateLoan(
        address lender,
        address borrower
    ) public {
        // TODO
    }
}
