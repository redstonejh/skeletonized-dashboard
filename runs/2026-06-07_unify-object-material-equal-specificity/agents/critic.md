# Critic Notes

Risk review focused on the previous failed run:

- The previous un-gate lowered selector specificity and produced `photoDiffCount: 25`.
- This run did not move declarations to base selectors.
- The final selector shape keeps a body plus one class/pseudo-class specificity profile.
- The static computed replay block is gone, so the material values now live in one shared declaration stack.

