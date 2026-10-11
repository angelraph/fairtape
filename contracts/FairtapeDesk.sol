// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title FairtapeDesk
/// @notice Fills testnet trades and payments at the live real-world market price.
/// The Fairtape server reads prices from mainnet sources (Robinhood market data, Chainlink, Jupiter) and signs a short-lived
/// quote. This contract only fills at a price that carries a valid signature, so no testnet pool can set the price.
/// Inventory is whatever the owner deposits; the desk can only fill what it holds.
/// Every supported token uses 18 decimals (Robinhood Chain Testnet USDC and stock tokens, and native ETH).
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

contract FairtapeDesk {
    /// @dev Prices are USD per one whole token, scaled by 1e18. `tokenIn == address(0)` or `tokenOut == address(0)` means native ETH.
    struct Quote {
        address tokenIn;
        address tokenOut;
        uint256 priceIn;
        uint256 priceOut;
        uint256 expiry;
    }

    address public owner;
    address public signer;
    uint256 private locked = 1;

    event Filled(address indexed payer, address indexed recipient, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 priceIn, uint256 priceOut);
    event SignerChanged(address signer);
    event OwnerChanged(address owner);

    error NotOwner();
    error BadSignature();
    error QuoteExpired();
    error SlippageExceeded();
    error InsufficientInventory();
    error BadAmount();
    error TransferFailed();
    error Reentrancy();

    constructor(address owner_, address signer_) {
        owner = owner_;
        signer = signer_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    receive() external payable {}

    /// @notice The message the signer signs for a quote. Bound to this contract and this chain.
    function quoteHash(Quote calldata q) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, q.tokenIn, q.tokenOut, q.priceIn, q.priceOut, q.expiry));
    }

    /// @notice Spend exactly `amountIn` and receive at least `minOut`, valued at the signed market prices.
    function swapExactIn(Quote calldata q, bytes calldata sig, uint256 amountIn, uint256 minOut, address recipient)
        external
        payable
        nonReentrant
        returns (uint256 amountOut)
    {
        _verify(q, sig);
        if (amountIn == 0) revert BadAmount();
        if (q.tokenIn == address(0) && msg.value != amountIn) revert BadAmount();
        amountOut = (amountIn * q.priceIn) / q.priceOut;
        if (amountOut < minOut || amountOut == 0) revert SlippageExceeded();
        _requireInventory(q.tokenOut, amountOut);
        _pull(q.tokenIn, amountIn);
        _push(q.tokenOut, recipient, amountOut);
        emit Filled(msg.sender, recipient, q.tokenIn, q.tokenOut, amountIn, amountOut, q.priceIn, q.priceOut);
    }

    /// @notice Deliver exactly `amountOut` to `recipient`, spending at most `maxIn`. Used to pay invoices with a stock.
    function swapExactOut(Quote calldata q, bytes calldata sig, uint256 amountOut, uint256 maxIn, address recipient)
        external
        payable
        nonReentrant
        returns (uint256 amountIn)
    {
        _verify(q, sig);
        if (amountOut == 0) revert BadAmount();
        // Round up so the desk is never short-changed by integer division.
        amountIn = (amountOut * q.priceOut + q.priceIn - 1) / q.priceIn;
        if (amountIn > maxIn) revert SlippageExceeded();
        _requireInventory(q.tokenOut, amountOut);
        _pull(q.tokenIn, amountIn);
        _push(q.tokenOut, recipient, amountOut);
        // Native ETH payers send maxIn; return what wasn't needed.
        if (q.tokenIn == address(0) && msg.value > amountIn) _sendEth(msg.sender, msg.value - amountIn);
        emit Filled(msg.sender, recipient, q.tokenIn, q.tokenOut, amountIn, amountOut, q.priceIn, q.priceOut);
    }

    // Owner: manage inventory and the price signer.

    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        _push(token, to, amount);
    }

    function setSigner(address signer_) external onlyOwner {
        signer = signer_;
        emit SignerChanged(signer_);
    }

    function setOwner(address owner_) external onlyOwner {
        owner = owner_;
        emit OwnerChanged(owner_);
    }

    // Internals.

    function _verify(Quote calldata q, bytes calldata sig) internal view {
        if (block.timestamp > q.expiry) revert QuoteExpired();
        if (q.priceIn == 0 || q.priceOut == 0 || q.tokenIn == q.tokenOut) revert BadAmount();
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", quoteHash(q)));
        if (sig.length != 65) revert BadSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        // Reject malleable signatures (upper-half s).
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) revert BadSignature();
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0) || recovered != signer) revert BadSignature();
    }

    /// @dev Checked before taking the payer's tokens, so a fill the desk can't cover fails with a clear reason.
    function _requireInventory(address token, uint256 amount) internal view {
        uint256 held = token == address(0) ? address(this).balance - msg.value : IERC20(token).balanceOf(address(this));
        if (held < amount) revert InsufficientInventory();
    }

    function _pull(address token, uint256 amount) internal {
        if (token == address(0)) {
            if (msg.value < amount) revert BadAmount();
            return;
        }
        if (msg.value != 0) revert BadAmount();
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20.transferFrom, (msg.sender, address(this), amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _push(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            // Keep any ETH the payer is sending in this same call out of the inventory check.
            if (address(this).balance < amount) revert InsufficientInventory();
            _sendEth(to, amount);
            return;
        }
        if (IERC20(token).balanceOf(address(this)) < amount) revert InsufficientInventory();
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _sendEth(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
