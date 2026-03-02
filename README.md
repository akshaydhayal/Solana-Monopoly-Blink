# Monopoly Blink 🎲🚀

The classic board game reinvented entirely as a **Solana Action/Blink** allowing two players to stake SOL, roll dice, buy 20 distinct properties, and bankrupt each other directly from inside their Solana wallet (like Phantom) or Twitter feed via Dial.to!

## Features 🌟

1. **Fully Playground in the Wallet:** You don't need a frontend to play! The entire game loop (create, join, roll, buy, skip) runs as natively integrated Action buttons through Dial.to.
2. **Real SOL Stakes:** Both players buy-in with `0.1 SOL` (Devnet) entry fee held in an Escrow Vault. Winner takes all `0.2 SOL`.
3. **Database-Driven Virtual Economy:** To prevent high network costs and delays, in-game rent and property purchases use virtual "Monopoly Money" synced via MongoDB. Real blockchain transactions are only invoked for the Entry Fee and Final Payout.
4. **Immersive Web Dashboard:** Includes a live, auto-refreshing 6x6 compact CSS Grid Dashboard displaying the 20-tile board, player positions (with animated emojis!), property ownership bars, and an active turn action log.

## Project Architecture 🏗️

- **Framework**: Next.js 16 (React + TypeScript)
- **Solana Integrations**: `@solana/actions`, `@solana/web3.js`
- **Database**: MongoDB (Mongoose) for real-time game state tracking without blockchain latency.
- **Styling**: Tailwind CSS
- **Deployment**: Vercel Serverless (with dynamic route forcing).

## How to Play 🎮

1. **Player 1 (Host)** initiates the game via the `Create Game` Blink, signing a transaction to send `0.1 SOL` to the escrow.
2. The Host shares the **Join Link** with Player 2.
3. **Player 2** joins, matching the `0.1 SOL` stake.
4. Both players take turns clicking **Roll Dice**. The game automatically resolves rent payments if they land on an owned property.
5. If an unowned property is landed on, the player can choose to **Buy** or **Skip**.
6. Play continues until one player runs out of virtual SOL and triggers a `BANKRUPT` status. The Escrow Vault automatically signs a transaction transferring the entire real SOL prize pool to the winner!

## Game Flow & Screenshots 📸

Here is the step-by-step flow of the game, played entirely within Dial.to Blinks!

<table>
  <tr>
    <td align="center">
      <b>1. Initial State (Player 1)</b><br/><br/>
      <img src="placeholder_1_before_create.png" alt="Before creating game for Player 1" width="300" />
    </td>
    <td align="center">
      <b>2. Game Created (Player 1)</b><br/><br/>
      <img src="placeholder_2_after_create.png" alt="After creating game, blink for Player 1" width="300" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <b>3. Incoming Invite (Player 2)</b><br/><br/>
      <img src="placeholder_3_before_join.png" alt="How blink looks for Player 2 before joining" width="300" />
    </td>
    <td align="center">
      <b>4. Game Joined (Player 2)</b><br/><br/>
      <img src="placeholder_4_after_join.png" alt="After joining game for Player 2" width="300" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <b>5. Roll Dice (Player 1)</b><br/><br/>
      <img src="placeholder_5_roll_dice.png" alt="Roll dice blink for Player 1" width="300" />
    </td>
    <td align="center">
      <b>6. Action Phase (Player 1)</b><br/><br/>
      <img src="placeholder_6_buy_property.png" alt="Player 1 rolled dice and saw options to buy or skip" width="300" />
    </td>
  </tr>
</table>

### Live Game Dashboard 🖥️

Players can watch their emojis move around the board in real-time as they click through the Blinks!

<div align="center">
  <img src="placeholder_7_dashboard.png" alt="The game dashboard page look" />
</div>

## Environment Setup 🛠️

Create a `.env.local` or `.env` file in the root directory:

```env
# URL for callbacks (important for Dial.to Mixed Content blocking)
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app

# Devnet RPC
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com

# Your MongoDB cluster connection string
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/monopoly

# System Escrow Wallet (Hold the entry fees and auto-pays the winner)
# Base58 private key array format
ESCROW_PRIVATE_KEY=[1,2,3...255]
```

## Running Locally 💻

```bash
npm install
npm run dev
# Note: To test actual Blinks in Dial.to, you MUST use ngrok to expose localhost as HTTPS.
ngrok http 3000
```
