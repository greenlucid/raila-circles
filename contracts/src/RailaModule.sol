// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Enum} from "safe-contracts/contracts/libraries/Enum.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract RailaModule {

    // Interest rates use Basis Points (denominator is 10_000)
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

    IERC20 immutable token;

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
        for (uint256 i = 0; i < path.length; i++) {
            // original lender is first address in the path.
            // caller (the safe) is the not included last element.
            address sender = path[i];
            address receiver = i < path.length - 1 ? path[i+1] : msg.sender; 

            updateLoan(sender, receiver);
            if (i != 0) {
                _borrow(sender, receiver, amount, irs[i]);
            }
        }
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
        Loan storage loan = loans[lender][borrower];
        if (loan.amount == 0) return;

        uint256 elapsed = block.timestamp - loan.timestamp;
        uint256 interest = loan.amount * loan.interestRatePerSecond * elapsed / 10_000;
        loan.amount += interest;
        loan.timestamp = block.timestamp;

        balances[lender].lent += interest;
        balances[lender].timestamp = block.timestamp;

        balances[borrower].borrowed += interest;
        balances[borrower].timestamp = block.timestamp;
    }

    // assume the loan is updated before calling this!
    function _borrow(
        address lender,
        address borrower,
        uint256 amount,
        uint256 ir
    ) internal {
        Loan storage loan = loans[lender][borrower];
        uint256 newIr = loan.amount == 0
            ? ir
            : (loan.amount * loan.interestRatePerSecond + amount * ir) / (loan.amount + amount);
        loan.interestRatePerSecond = newIr;
        loan.amount += amount;

        balances[lender].lent += amount;
        balances[borrower].borrowed += amount;
    }
}
