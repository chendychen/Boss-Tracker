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
    test('CSV cells keep quoted commas and quotes', () => {
        assert.deepEqual(parseCsv('a,"b, c","d ""e"""\n1,2,3'), [['a', 'b, c', 'd "e"'], ['1', '2', '3']]);
    });
});
