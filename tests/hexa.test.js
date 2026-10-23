import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { parseHexaScript, parseSheetPlan, parseCsv } from '../tools/hexa-orders.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({});
vm.runInContext(readFileSync(join(__dirname, '../hexa-engine.js'), 'utf8'), context);
const H = context.HexaEngine;

// A made-up class in the guide's shape.
const CLS = {
    origin: 'Origin Skill', ascent: 'Ascent Skill', mastery: ['M1', 'M2', 'M3', 'M4'],
    boost: ['B1', 'B2', 'B3', 'B4'], common: ['Sol Janus'],
    order: [[2, 1], [2, 2], [2, 3], [3, 1], [2, 4], [1, 2], [11, 1]],
};

describe('HEXA costs', () => {
    test('match the published totals per node type', () => {
        assert.equal(H.cost('Origin', 1, 30).frag, 4400);
        assert.equal(H.cost('Mastery', 0, 30).frag, 2252);
        assert.equal(H.cost('Boost', 0, 30).frag, 3383);
        assert.equal(H.cost('Common', 0, 30).frag, 6268);
        assert.deepEqual({ ...H.cost('Mastery', 0, 4) }, { erda: 6, frag: 103 });
    });
    test('the Ascent node costs 100 fragments to unlock; Origin starts free at 1', () => {
        assert.equal(H.cost('Origin', 0, 1).frag, 100);
        const nodes = [...H.nodesFor(CLS)];
        assert.equal(nodes.find(n => n.id === 1).start, 1);
        assert.equal(nodes.find(n => n.id === 10).start, 0);
    });
});

describe('HEXA order', () => {
    test('consecutive levels on one node join into a step', () => {
        const steps = [...H.steps(CLS)].map(s => `${s.node.name} ${s.from}->${s.to}`);
        assert.deepEqual(steps, ['M1 0->3', 'B1 0->1', 'M1 3->4', 'Origin Skill 1->2', 'HEXA Stat 0->1']);
    });
    test('progress follows the node levels', () => {
        const p = H.progress(CLS, { 2: 3 });
        assert.equal(p.done, 1);
        assert.equal(p.next.node.name, 'B1');
        const partial = H.progress(CLS, { 2: 2 });
        assert.equal(partial.steps[0].status, 'partial');
        assert.equal(partial.steps[0].owedFrag, H.cost('Mastery', 2, 3).frag);
    });
    test('our class names find the guide\'s', () => {
        const data = { classes: { 'Bow Master': CLS, 'Arch Mage (Ice, Lightning)': CLS, 'Sia Astelle': CLS } };
        assert.equal(H.guideClass(data, 'Bowmaster').name, 'Bow Master');
        assert.equal(H.guideClass(data, 'Ice/Lightning').name, 'Arch Mage (Ice, Lightning)');
        assert.equal(H.guideClass(data, 'Sia').name, 'Sia Astelle');
        assert.equal(H.guideClass(data, 'Erel Light'), null);
    });
});

// A made-up board in maplebot's shape: one level per row, FD compounding,
// the origin's free level 1 left out.
const BOARD = {
    nodes: [{ name: 'Orig', type: 'Origin', start: 1 }, { name: 'Hexa Stat 1', type: 'Hexa Stat' }, { name: 'Mast', type: 'Mastery' },
        { name: 'Asc', type: 'Origin' }, { name: 'Sol Janus', type: 'Common' }],
    steps: [
        { skill: 'Mast', to: 1, fd: 10, erda: 3, frag: 50 },
        { skill: 'Mast', to: 2, fd: 10, erda: 1, frag: 15 },
        { skill: 'Hexa Stat 1', to: 1, fd: null, erda: 5, frag: 324 },
        { skill: 'Orig', to: 2, fd: 1, erda: 1, frag: 30 },
    ],
};

describe('maplebot boards', () => {
    test('levels join into steps, HEXA Stat nodes become levels, FD compounds', () => {
        const s = [...H.boardSteps(BOARD)];
        assert.deepEqual(s.map(x => `${x.name} ${x.from}->${x.to}`), ['Mast 0->2', 'HEXA Stat 0->1', 'Orig 1->2']);
        assert.equal(s[0].frag, 65);
        assert.ok(Math.abs(s[0].fd - 21) < 1e-9);
        assert.deepEqual([...H.boardNodes(BOARD)].map(n => n.name), ['Orig', 'Asc', 'Mast', 'Sol Janus', 'HEXA Stat']);
    });
    test('progress by node name: partial steps owe their remaining levels; the origin starts at 1', () => {
        assert.equal(H.boardProgress(BOARD, {}).next.name, 'Mast');
        const p = H.boardProgress(BOARD, { Mast: 1 });
        assert.equal(p.done, 0);
        assert.equal(p.next.name, 'Mast');
        assert.deepEqual([p.next.owedErda, p.next.owedFrag], [1, 15]);
        assert.ok(Math.abs(p.fd - 10) < 1e-9);
        assert.ok(Math.abs(p.fdLeft - (1.1 * 1.01 * 100 - 100)) < 1e-9);
    });
    test('node names find the guide\'s ids; the free origin is the Origin, the other the Ascent', () => {
        const ids = H.boardNodeIds(BOARD, { ...CLS, origin: 'Orig', ascent: 'Point Zero', mastery: ['Mastery Skill', 'M2', 'M3', 'M4'] });
        assert.deepEqual({ ...ids }, { Orig: 1, Mast: 2, 'Sol Janus': 12, 'HEXA Stat': 11, Asc: 10 });
        // Two renamed nodes in one type are left alone rather than guessed.
        const two = { ...BOARD, nodes: [...BOARD.nodes, { name: 'Other', type: 'Mastery' }] };
        const ids2 = H.boardNodeIds(two, { ...CLS, mastery: ['Alpha Skill', 'Beta Skill'] });
        assert.equal(ids2.Mast, undefined);
        assert.equal(ids2.Other, undefined);
        assert.equal(H.boardFor({ classes: { Bowmaster: BOARD } }, 'Bowmaster').name, 'Bowmaster');
        assert.equal(H.boardFor({ classes: { Bowmaster: BOARD } }, 'Marksman'), null);
    });
});

describe('reading the sources', () => {
    test('the guide script: nodes by class and orders, brackets in names included', () => {
        const js = 'x={Pathy:{ascentSkill:"Asc",boostSkills:["B1","B2"],commonSkills:["Sol Janus"],masterySkills:["Arts [Tian]","M2"],originSkill:"Orig"},'
            + '"Two Words":{ascentSkill:"",boostSkills:[],commonSkills:["Sol Janus"],masterySkills:["X"],originSkill:"O"}},'
            + 'h=[{class:"Pathy",order:[[2,1],[9,1]]},{class:"Arch Mage (I/L)",order:[[1,2]]}]';
        const { classes } = parseHexaScript(js);
        assert.deepEqual(Object.keys(classes), ['Pathy', 'Two Words']);
        assert.deepEqual([...classes.Pathy.mastery], ['Arts [Tian]', 'M2']);
        assert.deepEqual(classes.Pathy.order, [[2, 1], [9, 1]]);
    });
    test('a sheet plan: steps under goals, level ranges and stones', () => {
        const csv = 'Credits: Someone,,,\n,,,\nSKILL,LEVEL,ERDA,FRAGS,CUMULATIVE FRAGS,FD (%),EFF\n'
            + 'Goal: Unlock M1,,,,,,\n"2% IED (R) + 1% IED (R)",-,2,100,100,0.15,0.15\nM1: Thing,1,2,50,150,15.9,31.9\n'
            + 'Goal: Get M1 to 9,,,,,,\nM1: Thing,2 --> 9,8,188,338,6.8,3.6\nShinestone #2,11,0,34.7,372.7,0.3,0.85\n';
        const plan = parseSheetPlan(csv);
        assert.equal(plan.credits, 'Credits: Someone');
        assert.equal(plan.steps.length, 4);
        assert.deepEqual([plan.steps[0].from, plan.steps[0].to], [null, null]);
        assert.deepEqual([plan.steps[2].from, plan.steps[2].to, plan.steps[2].goal], [1, 9, 'Get M1 to 9']);
        assert.deepEqual([plan.steps[3].from, plan.steps[3].to, plan.steps[3].frag], [10, 11, 34.7]);
        const p = H.planProgress(plan, 3);
        assert.equal(p.next.skill, 'Shinestone #2');
        assert.equal(p.owed.frag, 34.7);
        assert.equal(p.levels['M1: Thing'], 9);
    });
    test('plan skills: split stones add up, Shinestones cap at the plan top level, the origin starts at 1', () => {
        const step = (skill, from, to) => ({ goal: 'g', skill, levels: '', from, to, erda: 1, frag: 1, fd: 0 });
        const plan = { steps: [
            step('Origin', 1, 5), step('Salad (1)', 0, 15), step('Salad (2)', 0, 6),
            step('Shinestone #1', 0, 10), step('Shinestone #1', 10, 16), step('2% IED (R)', null, null),
        ] };
        const skills = [...H.planSkills(plan, { 'Salad (1)': 15, 'Salad (2)': 6, 'Shinestone #1': 10 })];
        assert.deepEqual(skills.map(s => `${s.name} ${s.level}/${s.cap}`), ['Origin 1/30', 'Salad 21/30', 'Shinestone #1 10/16']);
        assert.deepEqual([...skills[1].parts].map(p => p.level), [15, 6]);
    });
    test('Shinestone levels entered by hand replace the plan level, blanks fall back', () => {
        const plan = { steps: [{ skill: 'Shinestone #1', from: 0, to: 10 }, { skill: 'Shinestone #1', from: 10, to: 16 },
            { skill: 'M1: Ray', from: 0, to: 5 }] };
        const level = (stones, levels = { 'Shinestone #1': 10 }) =>
            [...H.planSkills(plan, levels, stones)].map(s => `${s.name} ${s.level}${s.manual ? '*' : ''}`).join(', ');
        assert.equal(level({}), 'Shinestone #1 10, M1: Ray 0');
        assert.equal(level({ 'Shinestone #1': 14 }), 'Shinestone #1 14*, M1: Ray 0');
        assert.equal(level({ 'Shinestone #1': '' }), 'Shinestone #1 10, M1: Ray 0');
        assert.equal(level({ 'M1: Ray': 9 }), 'Shinestone #1 10, M1: Ray 0');   // only stones take hand levels
        const stone = [...H.planSkills(plan, { 'Shinestone #1': 10 }, { 'Shinestone #1': 14 })][0].parts[0];
        assert.deepEqual([stone.level, stone.planned], [14, 10]);   // the plan's expectation stays visible
    });
    test('CSV cells keep quoted commas and quotes', () => {
        assert.deepEqual(parseCsv('a,"b, c","d ""e"""\n1,2,3'), [['a', 'b, c', 'd "e"'], ['1', '2', '3']]);
    });
});
