Unordered notes for the agent aiding development:

## Stack

// A Safe Module to handle the logic, and do bookeeping on the loans.
contracts/RailaModule.sol
// Everything else is Foundry boilerplate and tooling to deploy it in Gnosis Chain.

// A web interface (Intended to be connected with, with WalletConnect)
// Vite, TypeScript
web/

## Idea

Create a web of lending, making use of Circles directional trust graph.
If someone trusts you, you can borrow from them.
They could also borrow from someone else that trusts them to use their liquidity.

## How it works

### Contract

The contract is a Safe Module.
Assume that all avatars are Safe Wallets made with Metri.
And they're not group avatars.
Each user has settings:
- lending cap
- min IR for them to lend
- are they willing to autoborrow as part of a path? (if so, borrow_cap > 0)
- max IR for them to autoborrow
- min IR margin for them to autoborrow -> autolend

Loans are stored separately
IRs are computed linearly, but can be updated if users need the compounding
Interactions:

setSettings
borrow (amount, path, irs)
repay ... // how to use the paths here? should repay along their path as well?
updateLoan

### Interface

You are welcomed with graphic guide on how to add a wallet as signer in Metri
Connect here with WalletConnect with the thing as a Safe, etc.
It will make sure the Safe is in circles and display meta data such as nick, image if available.

Has you input settings.
Enable module -> input settings.

Display your borrowing/lending situation.
Can borrow. (We won't compute or use paths in demo?)
Lets you know you need USDC to be able to lend in the first place. (Although you could act as loan relayer)

// Show graphics? Like display a graph using circles sdk.


# Docs

Circles: https://docs.aboutcircles.com/llms.txt
Safe: https://docs.safe.global/llms.txt
