/*
 * Copyright (C) 2016  Tobias Bielefeld
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * If you want to contact me, send me an e-mail at tobias.bielefeld@gmail.com
 */

/**
 * PORT TO JAVASCRIPT of `games/Pyramid.java` — the rules themselves.
 *
 * New coverage: Pyramid was not in the TypeScript port, so unlike the Klondike suite these
 * names are new. The Java file is transcribed line for line, so these assert against the
 * behaviour the Android app has, not against what a Pyramid "should" do.
 */

import { beforeEach, describe, expect, it } from './runner.js';
import { shared, moveToStackSingle } from '../cards/engine/game/SharedData.js';
import { Card } from '../cards/engine/game/Card.js';
import { setupGame, findCard, VIEWPORT, WIDE, HEART, SPADE, CLUB } from './harness.js';

const PYRAMID = { game: 'Pyramid' };
const STOCK = 30; // getDealStack()
const DISCARD = 29; // getDiscardStack()
const KINGS = 28; // the "king" pile
const MAIN = 31; // the empty re-cycle slot

/** Row i of the pyramid starts at this stack id; the rows hold 1..7 cards. */
function rowStart(row) {
    return (row * (row + 1)) / 2;
}

function pyramid() {
    return setupGame(VIEWPORT, PYRAMID);
}

/** Empties the board and lays an exact position, so rules can be tested in isolation. */
function clearBoard() {
    for (const stack of shared.stacks) {
        stack.reset();
    }
}

/** Puts a specific card on a specific stack, face up. */
function place(card, stack) {
    stack.addCard(card);
    card.flipUp();
}

describe('Pyramid dealing', () => {
    beforeEach(pyramid);

    it('deals seven rows of 1..7 cards, all face up', () => {
        // Every pyramid position is its own stack holding exactly one card, so a row is a
        // range of positions rather than a fanned pile: row i owns
        // [i(i+1)/2, (i+1)(i+2)/2).
        for (let i = 0; i <= 27; i++) {
            expect(shared.stacks[i].getSize()).toBe(1);
            expect(shared.stacks[i].getTopCard().isUp()).toBe(true);
        }
        // and those ranges really do grow by one card at a time
        for (let row = 0; row < 7; row++) {
            expect(rowStart(row + 1) - rowStart(row)).toBe(row + 1);
        }
    });

    it('puts one card on the discard stack and leaves the rest on the stock', () => {
        // 52 - 28 pyramid - 1 discard
        expect(shared.stacks[DISCARD].getSize()).toBe(1);
        expect(shared.stacks[STOCK].getSize()).toBe(23);
        expect(shared.stacks[KINGS].getSize()).toBe(0);
        expect(shared.stacks[MAIN].getSize()).toBe(0);
    });

    it('leaves no card off the board', () => {
        let onBoard = 0;
        for (const stack of shared.stacks) {
            onBoard += stack.getSize();
        }
        expect(onBoard).toBe(52);
    });

    it('uses stack 30 as the deal stack and stack 31 as the main stack', () => {
        expect(shared.currentGame.getDealStack()).toBe(shared.stacks[STOCK]);
        expect(shared.currentGame.getMainStack()).toBe(shared.stacks[MAIN]);
        expect(shared.currentGame.getDiscardStack()).toBe(shared.stacks[DISCARD]);
    });
});

describe('Pyramid stack geometry', () => {
    beforeEach(pyramid);

    it('records the card resting on every pyramid position', () => {
        const game = shared.currentGame;

        // rowAboveID[r] points at the row below it, so stackAboveID of row i is row i+1.
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col <= row; col++) {
                const id = rowStart(row) + col;
                expect(game.stackAboveID[id]).toBe(rowStart(row + 1) + col);
            }
        }
        // The bottom row's written values run past the array; `stackIsFree` must never read
        // them, which is what the `id > 20` short-circuit is for.
        for (let col = 0; col <= 6; col++) {
            expect(game.stackAboveID[rowStart(6) + col]).toBeGreaterThan(27);
        }
    });

    it('treats a position as free only when both cards resting on it are gone', () => {
        const game = shared.currentGame;

        clearBoard();
        for (let i = 0; i <= 27; i++) {
            place(shared.cards[i], shared.stacks[i]);
        }

        // A full pyramid: everything but the bottom row is still covered.
        for (let i = 0; i <= 20; i++) {
            expect(game.stackIsFree(shared.stacks[i])).toBe(false);
        }
        for (let i = 21; i <= 27; i++) {
            expect(game.stackIsFree(shared.stacks[i])).toBe(true);
        }

        // Clearing the two cards that rest on the apex frees the apex.
        shared.stacks[1].reset();
        shared.stacks[2].reset();
        expect(game.stackIsFree(shared.stacks[0])).toBe(true);
    });

    it('needs both resting cards gone, not just one', () => {
        const game = shared.currentGame;
        clearBoard();
        for (let i = 0; i <= 27; i++) {
            place(shared.cards[i], shared.stacks[i]);
        }

        shared.stacks[1].reset(); // the left-hand card resting on the apex
        expect(game.stackIsFree(shared.stacks[0])).toBe(false);

        shared.stacks[2].reset(); // and now the right-hand one
        expect(game.stackIsFree(shared.stacks[0])).toBe(true);
    });

    it('treats the king pile, both discard stacks and the stock as free', () => {
        const game = shared.currentGame;
        for (const id of [KINGS, DISCARD, STOCK, MAIN]) {
            expect(game.stackIsFree(shared.stacks[id])).toBe(true);
        }
    });
});

describe('Pyramid card rules', () => {
    beforeEach(pyramid);

    it('accepts a king onto the king pile and nothing else', () => {
        clearBoard();
        const kings = shared.stacks[KINGS];

        expect(shared.currentGame.cardTest(kings, findCard(13, HEART))).toBe(true);
        expect(shared.currentGame.cardTest(kings, findCard(12, HEART))).toBe(false);
    });

    it('never accepts anything onto the empty main stack', () => {
        clearBoard();
        const main = shared.stacks[MAIN];

        expect(shared.currentGame.cardTest(main, findCard(13, HEART))).toBe(false);
        expect(shared.currentGame.cardTest(main, findCard(2, SPADE))).toBe(false);
    });

    it('accepts a card whose value and the target top card add up to 13', () => {
        clearBoard();
        place(findCard(7, HEART), shared.stacks[3]);
        const game = shared.currentGame;

        // Only the values matter — unlike Klondike there is no colour rule in Pyramid, so
        // a 6 of hearts pairs with a 7 of hearts just as readily as a 6 of spades.
        expect(game.cardTest(shared.stacks[3], findCard(6, SPADE))).toBe(true);
        expect(game.cardTest(shared.stacks[3], findCard(6, HEART))).toBe(true);
        expect(game.cardTest(shared.stacks[3], findCard(5, SPADE))).toBe(false); // 7 + 5 = 12
        expect(game.cardTest(shared.stacks[3], findCard(7, SPADE))).toBe(false); // 7 + 7 = 14
    });

    it('queues both cards and both origins when a pair is formed', () => {
        clearBoard();
        // 7H sits on a still-covered position (free because stacks 6 and 7 are empty);
        // the 6S waits on the bottom row, which is free by definition.
        const partner = findCard(7, HEART);
        const mover = findCard(6, SPADE);
        place(partner, shared.stacks[3]);
        place(mover, shared.stacks[21]);

        expect(shared.currentGame.cardTest(shared.stacks[3], mover)).toBe(true);
        expect(shared.currentGame.cardsToMove).toEqual([partner, mover]);
        expect(shared.currentGame.origins).toEqual([shared.stacks[3], shared.stacks[21]]);
    });

    it('will not pair onto a covered card', () => {
        clearBoard();
        const covered = findCard(7, HEART);
        place(covered, shared.stacks[1]);
        place(findCard(3, SPADE), shared.stacks[3]); // sits on top of stack 1

        expect(shared.currentGame.cardTest(shared.stacks[1], findCard(6, SPADE))).toBe(false);
    });

    it('lets the stock feed the discard stack and nothing else', () => {
        clearBoard();
        const game = shared.currentGame;
        const stockCard = findCard(5, SPADE);
        place(stockCard, shared.stacks[STOCK]);

        // Nothing on the discard, so the only rule left is "the stock may be turned over".
        expect(game.cardTest(shared.stacks[DISCARD], stockCard)).toBe(true);

        // A card already on the board may not be shoved onto the discard.
        place(findCard(9, SPADE), shared.stacks[21]);
        expect(game.cardTest(shared.stacks[DISCARD], findCard(9, SPADE))).toBe(false);
    });
});

describe('Pyramid picking cards up', () => {
    beforeEach(pyramid);

    it('refuses cards on the king pile', () => {
        clearBoard();
        const king = findCard(13, HEART);
        place(king, shared.stacks[KINGS]);

        expect(shared.currentGame.addCardToMovementGameTest(king)).toBe(false);
    });

    it('accepts cards from the discard and from any free position', () => {
        clearBoard();
        const game = shared.currentGame;
        const bottomRow = shared.cards[0];
        const covered = shared.cards[1];
        const covering = shared.cards[2];
        const onDiscard = shared.cards[3];
        const onStock = shared.cards[4];
        const onKings = shared.cards[5];

        place(bottomRow, shared.stacks[21]); // bottom row: free by definition
        place(covered, shared.stacks[1]); // stack 3 rests on it
        place(covering, shared.stacks[3]);
        place(onDiscard, shared.stacks[DISCARD]);
        place(onStock, shared.stacks[STOCK]);
        place(onKings, shared.stacks[KINGS]);

        expect(game.addCardToMovementGameTest(bottomRow)).toBe(true);
        expect(game.addCardToMovementGameTest(covered)).toBe(false);
        expect(game.addCardToMovementGameTest(covering)).toBe(true);
        expect(game.addCardToMovementGameTest(onDiscard)).toBe(true);
        expect(game.addCardToMovementGameTest(onStock)).toBe(true); // id > 20
        expect(game.addCardToMovementGameTest(onKings)).toBe(false); // the king pile is a sink
    });
});

describe('Pyramid pair removal', () => {
    beforeEach(pyramid);

    it('sends a formed pair to the king pile and scores 50', () => {
        clearBoard();
        const partner = findCard(7, HEART);
        const mover = findCard(6, SPADE);
        place(partner, shared.stacks[3]);
        place(mover, shared.stacks[21]);

        shared.currentGame.cardTest(shared.stacks[3], mover);
        shared.currentGame.testAfterMove();

        expect(shared.stacks[KINGS].getSize()).toBe(2);
        expect(shared.stacks[KINGS].getCard(0)).toBe(partner);
        expect(shared.stacks[KINGS].getCard(1)).toBe(mover);
        expect(shared.stacks[3].getSize()).toBe(0);
        expect(shared.scores.getScore()).toBe(50);
        expect(shared.currentGame.cardsToMove.length).toBe(0);
    });

    it('moves kings to the king pile on its own after a move', () => {
        clearBoard();
        shared.prefs.savePyramidAutoMove(true);

        place(findCard(13, HEART), shared.stacks[21]); // bottom row: free

        shared.currentGame.testAfterMove();

        expect(shared.stacks[KINGS].getSize()).toBe(1);
        expect(shared.stacks[KINGS].getTopCard().getValue()).toBe(13);
        expect(shared.stacks[21].getSize()).toBe(0);
        // the automatic move is not scored, only an explicit pair removal is
        expect(shared.scores.getScore()).toBe(0);
    });

    it('leaves a covered king alone', () => {
        clearBoard();
        shared.prefs.savePyramidAutoMove(true);

        // stack 3 rests on stack 1, so the king on stack 1 is not reachable
        place(findCard(13, HEART), shared.stacks[1]);
        place(findCard(3, SPADE), shared.stacks[3]);

        shared.currentGame.testAfterMove();

        expect(shared.stacks[KINGS].getSize()).toBe(0);
        expect(shared.stacks[1].getSize()).toBe(1);

        // once the covering card goes, the very next check takes the king
        shared.stacks[3].reset();
        shared.currentGame.testAfterMove();
        expect(shared.stacks[KINGS].getSize()).toBe(1);
    });

    it('does nothing at all when auto-move kings is off', () => {
        clearBoard();
        shared.prefs.savePyramidAutoMove(false);

        place(findCard(13, HEART), shared.stacks[21]);

        shared.currentGame.testAfterMove();

        expect(shared.stacks[KINGS].getSize()).toBe(0);
        expect(shared.stacks[21].getSize()).toBe(1);
    });
});

describe('Pyramid scoring', () => {
    beforeEach(pyramid);

    it('uses the same point table as the Java game', () => {
        const add = (cards, origin, destination) =>
            shared.currentGame.addPointsToScore(cards, new Array(cards.length).fill(origin),
                new Array(cards.length).fill(destination), false);

        const two = [shared.cards[0], shared.cards[1]];
        expect(add([shared.cards[0]], 3, KINGS, false)).toBe(50); // pair removed
        expect(add(two, DISCARD, STOCK, false)).toBe(-200); // stock re-cycled
        expect(add([shared.cards[0]], 0, 1, false)).toBe(0); // plain reposition
        // a single card from the discard is just the stock being drawn, not a re-cycle
        expect(add([shared.cards[0]], DISCARD, STOCK, false)).toBe(0);
    });

    it('never scores the re-cycle penalty twice for a single card', () => {
        // The Java guard is `cards.size() > 1 && origin == discard && dest == deal`, which
        // is what keeps an ordinary stock draw from costing 200 points.
        const before = shared.scores.getScore();
        shared.currentGame.addPointsToScore([shared.cards[0]], [DISCARD], [STOCK], false);
        expect(shared.scores.getScore()).toBe(before);
    });
});

describe('Pyramid stock', () => {
    beforeEach(pyramid);

    it('moves one card from the stock to the discard when pressed', () => {
        expect(shared.currentGame.onMainStackTouch()).toBe(1);
        expect(shared.stacks[STOCK].getSize()).toBe(22);
        expect(shared.stacks[DISCARD].getSize()).toBe(2);
    });

    it('returns everything from the discard back to the stock for 200 points', () => {
        const game = shared.currentGame;

        while (shared.stacks[STOCK].getSize() > 0) {
            game.onMainStackTouch();
        }
        expect(shared.stacks[STOCK].getSize()).toBe(0);

        const onDiscard = shared.stacks[DISCARD].getSize();
        expect(onDiscard).toBeGreaterThan(0);

        expect(game.onMainStackTouch()).toBe(2);
        expect(shared.stacks[STOCK].getSize()).toBe(onDiscard);
        expect(shared.stacks[DISCARD].getSize()).toBe(0);
        expect(shared.scores.getScore()).toBe(-200);
    });

    it('does nothing when both the stock and the discard are empty', () => {
        clearBoard();
        expect(shared.currentGame.onMainStackTouch()).toBe(0);
    });

    it('responds to the empty stock and always to the main slot', () => {
        clearBoard();
        const game = shared.currentGame;
        const stock = shared.stacks[STOCK];
        const main = shared.stacks[MAIN];

        expect(game.testIfMainStackTouched(stock.getX() + 5, stock.getY() + 5)).toBe(true);

        place(findCard(5, HEART), stock);
        expect(game.testIfMainStackTouched(stock.getX() + 5, stock.getY() + 5)).toBe(false);
        expect(game.testIfMainStackTouched(main.getX() + 5, main.getY() + 5)).toBe(true);
    });
});

describe('Pyramid hints and win detection', () => {
    beforeEach(pyramid);

    it('suggests the king pile for a free king', () => {
        clearBoard();
        place(findCard(13, HEART), shared.stacks[6]);

        const hint = shared.currentGame.hintTest([]);
        expect(hint.card.getValue()).toBe(13);
        expect(hint.stack).toBe(shared.stacks[KINGS]);
    });

    it('suggests a partner for a pair', () => {
        clearBoard();
        place(findCard(7, HEART), shared.stacks[6]);
        place(findCard(6, SPADE), shared.stacks[7]);

        const hint = shared.currentGame.hintTest([]);
        expect(hint.card.getValue() + hint.stack.getTopCard().getValue()).toBe(13);
    });

    it('has no hint when nothing on the board adds up', () => {
        clearBoard();
        // 10 + 11 = 21, 10 + 5 = 15, 11 + 5 = 16 — no pair, and no king either
        place(findCard(10, HEART), shared.stacks[21]);
        place(findCard(11, HEART), shared.stacks[22]);
        place(findCard(5, SPADE), shared.stacks[23]);

        expect(shared.currentGame.hintTest([])).toBeNull();
    });

    it('does not suggest a pair that involves a covered card', () => {
        clearBoard();
        // The 5 pairs with the 8, but the 8 still has a card resting on it.
        place(findCard(8, HEART), shared.stacks[1]);
        place(findCard(3, SPADE), shared.stacks[3]);
        place(findCard(5, SPADE), shared.stacks[21]);

        expect(shared.currentGame.hintTest([])).toBeNull();
    });

    it('is won as soon as the pyramid is empty on easy, but needs an empty stock on hard', () => {
        clearBoard();
        place(findCard(9, SPADE), shared.stacks[STOCK]);

        shared.prefs.savePyramidDifficulty('1');
        expect(shared.currentGame.winTest()).toBe(true);

        shared.prefs.savePyramidDifficulty('2');
        expect(shared.currentGame.winTest()).toBe(false);

        shared.stacks[STOCK].reset();
        expect(shared.currentGame.winTest()).toBe(true);
    });

    it('is not won while a single pyramid card is left', () => {
        clearBoard();
        place(findCard(4, SPADE), shared.stacks[27]);
        shared.prefs.savePyramidDifficulty('1');

        expect(shared.currentGame.winTest()).toBe(false);
    });
});

describe('Pyramid double tap', () => {
    beforeEach(pyramid);

    it('sends a king straight to the king pile', () => {
        clearBoard();
        const king = findCard(13, HEART);
        place(king, shared.stacks[21]);

        expect(shared.currentGame.doubleTapTest(king)).toBe(shared.stacks[KINGS]);
        // Note: the Java returns early for a king and never fills cardsToMove/origins, so
        // the engine's own single-card move to stack 28 is what actually happens.
        expect(shared.currentGame.cardsToMove).toEqual([]);
        expect(shared.currentGame.origins).toEqual([]);
    });

    it('pairs a card with a partner on the board', () => {
        clearBoard();
        const partner = findCard(7, HEART);
        const mover = findCard(6, SPADE);
        place(partner, shared.stacks[6]);
        place(mover, shared.stacks[7]);

        expect(shared.currentGame.doubleTapTest(mover)).toBe(shared.stacks[6]);
        expect(shared.currentGame.cardsToMove).toEqual([partner, mover]);
        expect(shared.currentGame.origins).toEqual([shared.stacks[6], shared.stacks[7]]);
    });

    it('pairs a card with the top of the discard or the stock', () => {
        clearBoard();
        const fromStock = findCard(6, SPADE);
        place(fromStock, shared.stacks[7]);
        place(findCard(7, HEART), shared.stacks[STOCK]);
        expect(shared.currentGame.doubleTapTest(fromStock)).toBe(shared.stacks[STOCK]);

        clearBoard();
        place(fromStock, shared.stacks[7]);
        place(findCard(7, HEART), shared.stacks[DISCARD]);
        expect(shared.currentGame.doubleTapTest(fromStock)).toBe(shared.stacks[DISCARD]);
    });

    it('falls back to putting a stock card on the discard when nothing pairs', () => {
        clearBoard();
        const card = findCard(6, SPADE);
        place(card, shared.stacks[STOCK]);

        expect(shared.currentGame.doubleTapTest(card)).toBe(shared.stacks[DISCARD]);
    });

    it('returns null when there is nothing to do', () => {
        clearBoard();
        const card = findCard(6, SPADE);
        place(card, shared.stacks[7]);

        expect(shared.currentGame.doubleTapTest(card)).toBeNull();
    });
});

describe('Pyramid layout', () => {
    it('fans seven rows out from a centred apex', () => {
        setupGame(VIEWPORT, PYRAMID);
        const game = shared.currentGame;
        const spacing = game.setUpHorizontalSpacing(VIEWPORT, 7, 8);

        for (let row = 0; row < 7; row++) {
            const startPosX =
                VIEWPORT.width / 2 - ((row + 1) * Card.width) / 2 - (row * spacing) / 2;
            const startPosY =
                (VIEWPORT.isLandscape ? Card.width / 4 : Card.width / 2) +
                (row * Card.height) / 2;

            for (let col = 0; col <= row; col++) {
                const stack = shared.stacks[rowStart(row) + col];
                const expectedX = startPosX + col * (spacing + Card.width);
                expect(Math.abs(stack.getX() - expectedX)).toBeLessThan(0.00001);
                expect(Math.abs(stack.getY() - startPosY)).toBeLessThan(0.00001);
            }
        }
    });

    it('keeps every pyramid row on screen', () => {
        setupGame(VIEWPORT, PYRAMID);
        for (let i = 0; i <= 27; i++) {
            expect(shared.stacks[i].getX()).toBeGreaterThanOrEqual(0);
            expect(shared.stacks[i].getX() + Card.width).toBeLessThanOrEqual(VIEWPORT.width);
        }
    });

    it('puts the king pile, the discard, the main slot and the stock in one row below', () => {
        setupGame(VIEWPORT, PYRAMID);

        for (const id of [KINGS, DISCARD, MAIN, STOCK]) {
            expect(shared.stacks[id].getY()).toBeGreaterThan(shared.stacks[27].getY());
        }
        // left to right: king pile, discard, main slot, stock
        expect(shared.stacks[KINGS].getX()).toBeLessThan(shared.stacks[DISCARD].getX());
        expect(shared.stacks[DISCARD].getX()).toBeLessThan(shared.stacks[MAIN].getX());
        expect(shared.stacks[MAIN].getX()).toBeLessThan(shared.stacks[STOCK].getX());
    });

    it('sizes the cards to fit seven across', () => {
        setupGame(VIEWPORT, PYRAMID);
        expect(Card.width).toBe(VIEWPORT.width / 8);
        expect(Card.height).toBe(Math.trunc((VIEWPORT.width / 8) * 1.5));
    });

    it('re-lays out in landscape without throwing', () => {
        setupGame(WIDE, PYRAMID);
        expect(shared.stacks[0].getY()).toBeGreaterThanOrEqual(0);
        expect(shared.stacks[STOCK].getX() + Card.width).toBeLessThanOrEqual(WIDE.width);
    });
});

describe('Pyramid undo', () => {
    beforeEach(pyramid);

    it('puts a removed pair back where the two cards came from', () => {
        clearBoard();
        const partner = findCard(7, HEART);
        const mover = findCard(6, SPADE);
        place(partner, shared.stacks[3]);
        place(mover, shared.stacks[21]);

        shared.currentGame.cardTest(shared.stacks[3], mover);
        shared.currentGame.testAfterMove();
        expect(shared.stacks[KINGS].getSize()).toBe(2);

        shared.recordList.undoMore();

        expect(shared.stacks[3].getSize()).toBe(1);
        expect(shared.stacks[3].getTopCard()).toBe(partner);
        expect(shared.stacks[21].getSize()).toBe(1);
        expect(shared.stacks[21].getTopCard()).toBe(mover);
        expect(shared.stacks[KINGS].getSize()).toBe(0);
    });

    it('undoes an auto-moved king', () => {
        clearBoard();
        shared.prefs.savePyramidAutoMove(true);
        const king = findCard(13, HEART);
        place(king, shared.stacks[21]);

        shared.currentGame.testAfterMove();
        expect(shared.stacks[KINGS].getSize()).toBe(1);

        shared.recordList.undoMore();
        expect(shared.stacks[21].getSize()).toBe(1);
        expect(shared.stacks[21].getTopCard()).toBe(king);
    });
});

describe('Pyramid move plumbing', () => {
    beforeEach(pyramid);

    it('moves a whole run of cards at once, as the engine does for any game', () => {
        clearBoard();
        const cards = [findCard(6, SPADE), findCard(7, HEART), findCard(13, CLUB)];
        for (const card of cards) {
            place(card, shared.stacks[0]);
        }

        moveToStackSingle(cards.slice(0, 2), shared.stacks[KINGS], 2);

        expect(shared.stacks[KINGS].getSize()).toBe(2);
        expect(shared.stacks[0].getSize()).toBe(1);
        expect(shared.stacks[0].getTopCard()).toBe(cards[2]);
    });
});