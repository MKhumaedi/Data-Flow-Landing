import { INITIAL_FORMULA_SEEDS } from '../features/formulas/formula.seed';
import { evaluateFormulaWithHyperFormula } from '../features/formulas/lib/formulaEvaluator';

console.log('Total seeds:', INITIAL_FORMULA_SEEDS.length);

let validatedCount = 0;
let flaggedCount = 0;
const flaggedList: { name: string; slug: string; category: string; errors: string[] }[] = [];

INITIAL_FORMULA_SEEDS.forEach((item) => {
  const result = evaluateFormulaWithHyperFormula(item.syntaxExample, item.practiceData);
  if (result.isValid) {
    validatedCount++;
  } else {
    flaggedCount++;
    flaggedList.push({
      name: item.name,
      slug: item.slug,
      category: item.category,
      errors: result.errors,
    });
  }
});

console.log(`\n=== HYPERFORMULA EVALUATION BREAKDOWN ===`);
console.log(`Total Formulas: ${INITIAL_FORMULA_SEEDS.length}`);
console.log(`Successfully Validated: ${validatedCount}`);
console.log(`Flagged / Static Reference: ${flaggedCount}`);
console.log(`\nFlagged Items Detail:`);
flaggedList.forEach((f) => {
  console.log(`- [${f.category}] ${f.name} (${f.slug}): ${f.errors.join(', ')}`);
});
