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
 * PORT TO JAVASCRIPT (plain ES modules, no build step, run directly by the browser).
 *
 * Direct port of `app/src/main/java/de/tobiasbielefeld/solitaire/games/Pyramid.java`.
 * Behaviour is intentionally identical; only the language changed.
 *
 * Pyramid Solitaire! It has a lot of stacks.
 *
 * Stack map (32 stacks, 52 cards, one deck):
 *   0..27  the pyramid itself — seven rows of 1..7 cards
 *   28     the "king" pile: every removed pair is stacked here
 *   29     the first discard stack (`getDiscardStack()`)
 *   30     the stock cards are dealt from here (`getDealStack()`, also a discard id)
 *   31     the main stack — an empty slot that re-cycles 29 back onto 30
 *
 * Note that in this game `getDealStack()` is stack 30 (setDealFromID(30)), not the main
 * stack, which is why `onMainStackTouch` moves a card from 30 to 29.
 *
 * `stackAboveID` records, for every pyramid position, the index of the card resting on it.
 * Row i+1 starts at index (i+1)(i+2)/2, which is the formula in `setStacks`. For the bottom
 * row (ids 21..27) the written values exceed the array, which is harmless in Java and here:
 * `stackIsFree()` short-circuits on `getId() > 20` before ever reading them.
 */

import { Game } from './cards/engine/game/Game.js';
import {
    shared,
    moveCardToStack,
    moveToStackSingle,
    resendAfterMove,
} from './cards/engine/game/SharedData.js';
import { Card } from './cards/engine/game/Card.js';

const OPTION_NO_RECORD = 2;

export class Pyramid extends Game {
    constructor() {
        super();
        this.stackAboveID = new Array(28).fill(0);
        this.cardsToMove = [];
        this.origins = [];

        this.setNumberOfDecks(1);
        this.setNumberOfStacks(32);

        this.setTableauStackIDs(
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
            14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
        );
        this.setDiscardStackIDs(29, 30);
        this.setMainStackIDs(31);
        this.setDealFromID(30);

        // empty so all stacks have no spacing direction
        this.setDirections();

        this.setNumberOfRecycles('pref_key_pyramid_number_of_recycles', '2');

        this.toggleRecycles(shared.prefs.getSavedPyramidLimitedRecycles());
    }

    reset() {
        super.reset();
        this.cardsToMove.length = 0;
    }

    setStacks(layout) {
        // Android used (7+1, 5+1). A 5.5 column fit leaves a little more height for the
        // cards on tall desktop playfields without changing phone/tablet layouts much —
        // those are usually width-limited first.
        this.setUpCardDimensions(layout, 7 + 1, 5.5);

        const spacing = this.setUpHorizontalSpacing(layout, 7, 8);

        let index = 0;
        for (let i = 0; i < 7; i++) {
            const startPosX = layout.width / 2 - (i + 1) * Card.width / 2 - (i * spacing) / 2;
            const startPosY = (layout.isLandscape ? Card.width / 4 : Card.width / 2) + (i * Card.height) / 2;

            for (let j = 0; j < i + 1; j++) {
                this.stackAboveID[index] = ((i + 1) * (i + 2)) / 2 + j;

                shared.stacks[index].setX(startPosX + j * (spacing + Card.width));
                shared.stacks[index].setY(startPosY);
                shared.stacks[index].backgroundKey = 'transparent';

                index++;
            }
        }

        shared.stacks[28].setX(shared.stacks[21].getX() + Card.width / 2 + spacing / 2);
        shared.stacks[28].setY(
            shared.stacks[21].getY() + Card.height + (layout.isLandscape ? Card.width / 4 : Card.width / 2),
        );

        shared.stacks[29].setX(shared.stacks[24].getX() + Card.width / 2);
        shared.stacks[29].setY(shared.stacks[28].getY());

        shared.stacks[31].setX(shared.stacks[29].getX() + Card.width + spacing);
        shared.stacks[31].setY(shared.stacks[28].getY());
        this.setArrow(shared.stacks[31]);

        shared.stacks[30].setX(shared.stacks[31].getX() + Card.width + spacing);
        shared.stacks[30].setY(shared.stacks[28].getY());
    }

    winTest() {
        for (let i = 0; i <= this.getLastTableauId(); i++) {
            if (!shared.stacks[i].isEmpty()) {
                return false;
            }
        }

        return (
            shared.prefs.getSavedPyramidDifficulty() === '1' ||
            (this.getDiscardStack().isEmpty() && shared.stacks[30].isEmpty())
        );
    }

    dealCards() {
        this.flipAllCardsUp();

        for (let i = 0; i < 28; i++) {
            moveCardToStack(this.getDealStack().getTopCard(), shared.stacks[i], OPTION_NO_RECORD);
        }

        moveCardToStack(this.getDealStack().getTopCard(), this.getDiscardStack(), OPTION_NO_RECORD);
    }

    testIfMainStackTouched(X, Y) {
        return (
            (this.getDealStack().isEmpty() && this.getDealStack().isOnLocation(X, Y)) ||
            this.getMainStack().isOnLocation(X, Y)
        );
    }

    onMainStackTouch() {
        if (!this.getDealStack().isEmpty()) {
            moveCardToStack(this.getDealStack().getTopCard(), this.getDiscardStack());
            return 1;
        } else if (!this.getDiscardStack().isEmpty()) {
            shared.recordList.add(this.getDiscardStack().currentCards);

            while (this.getDiscardStack().getSize() > 0) {
                moveCardToStack(this.getDiscardStack().getTopCard(), this.getDealStack(), OPTION_NO_RECORD);
            }

            shared.scores.update(-200); // because of no record, it isn't updated automatically
            return 2;
        }

        return 0;
    }

    cardTest(stack, card) {
        if (stack.getId() === 31) {
            return false;
        }

        if (stack.getId() === 28 && card.getValue() === 13) {
            return true;
        }

        if (
            stack.getId() !== 28 &&
            !stack.isEmpty() &&
            this.stackIsFree(stack) &&
            card.getValue() + stack.getTopCard().getValue() === 13
        ) {
            this.cardsToMove.length = 0;
            this.origins.length = 0;

            this.cardsToMove.push(stack.getTopCard());
            this.cardsToMove.push(card);

            this.origins.push(stack);
            this.origins.push(card.getStack());

            return true;
        }

        return card.getStack() === this.getDealStack() && stack === this.getDiscardStack();
    }

    addCardToMovementGameTest(card) {
        if (card.getStackId() === 28) {
            return false;
        }

        if (card.getStackId() === this.getDiscardStack().getId()) {
            return true;
        }

        const currentStack = card.getStack();

        return currentStack.getId() > 20 || this.stackIsFree(currentStack);
    }

    hintTest(visited) {
        const freeStacks = [];

        for (let i = 0; i <= this.getLastTableauId(); i++) {
            if (
                this.stackIsFree(shared.stacks[i]) &&
                !shared.stacks[i].isEmpty() &&
                !visited.includes(shared.stacks[i].getTopCard())
            ) {
                freeStacks.push(shared.stacks[i]);
            }
        }

        // first discard stack
        if (!this.getDiscardStack().isEmpty() && !visited.includes(this.getDiscardStack().getTopCard())) {
            freeStacks.push(this.getDiscardStack());
        }
        // second discard stack
        if (!shared.stacks[30].isEmpty() && !visited.includes(shared.stacks[30].getTopCard())) {
            freeStacks.push(shared.stacks[30]);
        }

        for (const stack of freeStacks) {
            if (stack.getTopCard().getValue() === 13) {
                return { card: stack.getTopCard(), stack: shared.stacks[28] };
            }

            for (const otherStack of freeStacks) {
                if (stack.getId() === otherStack.getId()) {
                    continue;
                }

                if (
                    this.stackIsFree(stack) &&
                    stack.getTopCard().getValue() + otherStack.getTopCard().getValue() === 13
                ) {
                    return { card: stack.getTopCard(), stack: otherStack };
                }
            }
        }

        return null;
    }

    doubleTapTest(card) {
        let returnStack = null;

        if (card.getValue() === 13) {
            return shared.stacks[28];
        }

        for (let i = this.getLastTableauId(); i >= 0; i--) {
            if (shared.stacks[i].isEmpty()) {
                continue;
            }

            if (
                card.getStackId() !== i &&
                this.stackIsFree(shared.stacks[i]) &&
                card.getValue() + shared.stacks[i].getTopCard().getValue() === 13
            ) {
                returnStack = shared.stacks[i];
                break;
            }
        }

        if (
            returnStack === null &&
            !this.getDiscardStack().isEmpty() &&
            card.getStack() !== this.getDiscardStack() &&
            card.getValue() + this.getDiscardStack().getTopCard().getValue() === 13
        ) {
            returnStack = this.getDiscardStack();
        }

        if (
            returnStack === null &&
            !this.getDealStack().isEmpty() &&
            card.getStack() !== this.getDealStack() &&
            card.getValue() + this.getDealStack().getTopCard().getValue() === 13
        ) {
            returnStack = this.getDealStack();
        }

        if (returnStack !== null) {
            this.cardsToMove.push(returnStack.getTopCard());
            this.cardsToMove.push(card);

            this.origins.push(returnStack);
            this.origins.push(card.getStack());
            return returnStack;
        }

        if (card.getStack() === this.getDealStack()) {
            return this.getDiscardStack();
        }

        return null;
    }

    addPointsToScore(cards, originIDs, destinationIDs, _isUndoMovement) {
        if (destinationIDs[0] === 28) {
            return 50;
        } else if (
            cards.length > 1 &&
            originIDs[0] === this.getDiscardStack().getId() &&
            destinationIDs[0] === this.getDealStack().getId()
        ) {
            return -200;
        } else {
            return 0;
        }
    }

    testAfterMove() {
        if (this.cardsToMove.length > 0) {
            shared.recordList.deleteLast();
            moveToStackSingle(this.cardsToMove, shared.stacks[28], OPTION_NO_RECORD);
            shared.recordList.addWithOrigins(this.cardsToMove, this.origins);
            shared.scores.update(50);

            this.cardsToMove.length = 0;
            this.origins.length = 0;

            resendAfterMove();
        } else if (shared.prefs.getSavedPyramidAutoMove()) {
            const tempCards = [];
            const origins = [];

            for (let i = 0; i < 32; i++) {
                if (i === 28) {
                    continue;
                }

                if (
                    !shared.stacks[i].isEmpty() &&
                    this.stackIsFree(shared.stacks[i]) &&
                    shared.stacks[i].getTopCard().getValue() === 13
                ) {
                    tempCards.push(shared.stacks[i].getTopCard());
                    origins.push(shared.stacks[i]);
                }
            }

            if (tempCards.length !== 0) {
                shared.recordList.addToLastEntry(tempCards, origins);
                moveToStackSingle(tempCards, shared.stacks[28], OPTION_NO_RECORD);
            }
        }
    }

    stackIsFree(stack) {
        if (stack.getId() > 20) {
            return true;
        }

        const stackAbove1 = shared.stacks[this.stackAboveID[stack.getId()]];
        const stackAbove2 = shared.stacks[this.stackAboveID[stack.getId()] + 1];

        return stackAbove1.isEmpty() && stackAbove2.isEmpty();
    }
}