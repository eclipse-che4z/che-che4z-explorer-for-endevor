/**
 * You forgot a switch case and your switch is not exhaustive.
 * That's why typescript compiler errors on instantiation of this class.
 */
export class UnreachableCaseError extends Error {
  constructor(value: never) {
    super(`Unreachable case: ${value}`);
  }
}
