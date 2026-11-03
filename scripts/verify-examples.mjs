import assert from 'node:assert/strict'
import fs from 'node:fs'
import { britishPhonetic } from '../app/core/ielts/phonetics.ts'
import { practiceExamples } from '../app/core/ielts/examples.ts'
const topics = JSON.parse(fs.readFileSync(new URL('../app/core/ielts/topics.json', import.meta.url)))
let count = 0
for (const topic of topics) {
  const words = JSON.parse(fs.readFileSync(new URL(`../public/dicts/en/word/${topic.url}`, import.meta.url)))
  for (const word of words) {
    const before = JSON.stringify(word)
    assert.ok(britishPhonetic(word), `missing British IPA for ${word.word}`)
    const sentence = practiceExamples(word)[0]?.c
    assert.ok(sentence, `missing example for ${word.word}`)
    assert.ok(sentence.toLowerCase().includes(word.word.toLowerCase()), `example should demonstrate ${word.word}`)
    assert.equal(JSON.stringify(word), before, 'example lookup must not change dictionary data')
    count++
  }
}
const old = { word: 'biodiversity', sentences: [{ c: 'An existing example stays intact.', cn: '原有例句' }] }
assert.deepEqual(practiceExamples(old), old.sentences)
assert.deepEqual(practiceExamples({ word: 'an-imported-word', sentences: [] }), [])
console.log(
  `PASS: ${count} IELTS entries have display-only examples and IPA; existing sentences take priority and dictionaries are unchanged`
)
