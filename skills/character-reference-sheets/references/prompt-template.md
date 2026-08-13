# The prompt architecture

Seven blocks, in this order. Prompts are always in English and always
self-contained — generations run in a clean session with no conversation
context.

```
I'm attaching two images.

IMAGE 1 - [what the base render is]. This is the base. Everything in it
must be preserved.

IMAGE 2 - [what the clothing reference is]. Use it ONLY as a reference for
which clothing to add. Completely ignore its [style, pose, anatomy, and
everything present in it that is absent from the render].

TASK: dress the character from IMAGE 1 in that outfit.

Clothing to add:
- [one line per piece]

Hardware must be crisp and consistent: [the hardware this outfit has].
Keep every piece of hardware sharp and correctly repeated rather than
smeared, melted or randomly shaped.

PRESERVE EXACTLY, with no alteration:
- [preservation list]

Output: a single image, same framing as IMAGE 1.
```

## Block by block

**IMAGE 1** — declare that it is the base and that everything in it is
preserved. Describe the *kind* of image (3D render, A-pose, orthographic camera,
white background, flat shading), never the character's anatomy.

**IMAGE 2** — declare that it serves **only** to say which clothing. Then list
explicitly what to ignore in it. Anything present in the concept art and absent
from the render must be named, or the model will add it: hair, tail, weapon,
beard, horns, wings. Also instruct it to ignore painting style, lineart,
lighting, background, pose and anatomy.

**TASK** — one sentence. It states that the operation is dressing, not drawing.

**Clothing to add** — pieces only. No mention of the body. A detail that
separates the piece from a generic one (flap pocket, crooked knot, colour panel)
is worth more than a quality adjective.

**Hardware** — a dedicated paragraph. Hardware is where the model smears most:
buckles without frames, melted chain links, irregular eyelets. Name the hardware
this particular outfit actually has.

**PRESERVE EXACTLY** — the block that holds everything together. Fixed base:

```
- The same A-pose, in the same position and angle
- The same orthographic front camera, same framing and same body scale
  within the frame
- The same arm span: the hands stay exactly where they are, at the same
  distance from the left and right edges
- The plain white background, no shadow, no scenery, no gradient
- The same clean 3D render style with flat colors: DO NOT paint it, DO NOT
  add fabric photorealism, DO NOT add grain, DO NOT add dramatic lighting,
  DO NOT add outlines
- The same character colors and markings, the same proportions, the same
  [head, muzzle, ears, eyes, hands, feet — whatever this character has]
```

The arm span line matters most in A-pose and T-pose: with the arms out, width is
what constrains the frame, and width is where framing breaks.

**Output** — restate that it is a single image, same framing.

## Reference order

Base **first**, clothing sheet after. The array order is the order the prompt
calls IMAGE 1 and IMAGE 2.

## A real example that worked

Anthropomorphic tiger, front A-pose render plus approved concept art. Result:
`ocup_h` 88.9% → 89.2%, a 0.3 point deviation.

```
I'm attaching two images.

IMAGE 1 - a 3D render of my character in A-pose, orthographic front view,
plain white background, flat matte shading with solid colors. This is the
base. Everything in it must be preserved.

IMAGE 2 - a concept illustration. Use it ONLY as a reference for which
clothing to add. Completely ignore its painting style, its lineart, its
lighting, its pose and its anatomy. Also ignore its head hair, its tail
and its sword - none of those exist in IMAGE 1 and none must be added.

TASK: dress the character from IMAGE 1 in that outfit.

Clothing to add:
- Crisp white short-sleeve button-up dress shirt, sleeves ending mid-bicep,
  top three buttons undone showing the cream chest fur, collar open, hem
  untucked and hanging loose over the pants, and a buttoned flap chest
  pocket on the left side
- A crimson red necktie, knotted but yanked loose: the knot sits low below
  the open collar and is visibly crooked and off-center, the wide end
  trailing down askew, as if just pulled down after work
- Very baggy loose black cargo pants, deep flap utility pockets on the
  thighs, buckle straps, D-rings and hanging webbing, waistband riding on
  the hips, fabric pooling and stacking over the shoes
- Crimson red cloth hand wraps fully covering the palms, the backs of the
  hands and the knuckles, then winding up both forearms, with loose ends
  trailing from the wrists. The fingers stay bare from the first knuckle up
- Bold chunky designer high-top sneakers, white with crimson red panels,
  stitching and laces, thick sculpted white sole, oversized padded tongue,
  small red tiger emblem on the outer side
- Thin silver chain necklace with a small silver tiger emblem pendant

Hardware must be crisp and consistent: shirt buttons are uniform and evenly
spaced, buckles have readable frames and prongs, D-rings are cleanly closed,
chain links are individually defined and of even size, sneaker eyelets are
regular and the laces cross evenly. Keep every piece of hardware sharp and
correctly repeated rather than smeared, melted or randomly shaped.

PRESERVE EXACTLY, with no alteration:
- The same A-pose, in the same position and angle
- The same orthographic front camera, same framing and same body scale
  within the frame
- The same arm span: the hands stay exactly where they are, at the same
  distance from the left and right edges
- The plain white background, no shadow, no scenery, no gradient
- The same clean 3D render style with flat colors: DO NOT paint it, DO NOT
  add fabric photorealism, DO NOT add grain, DO NOT add dramatic lighting,
  DO NOT add outlines
- The same character colors and markings, the same proportions, the same
  bald head with no hair, the same muzzle, ears, amber eyes, hand and foot
  shapes, and no tail

Output: a single image, same framing as IMAGE 1.
```

## Counter-example — what not to do

This prompt, on the same render and the same model, collapsed the arm span by
14.6 points:

```
Full body front view of a heavyset bara-build anthropomorphic tiger, adult
male: tall, very broad shoulders, thick muscular arms, wide barrel chest,
thick waist, heavy thighs, small head relative to the body. Standing in a
neutral symmetrical A-pose facing the viewer: legs straight and
shoulder-width apart, both arms hanging down...
```

Three mistakes at once: it describes the anatomy, it describes the pose in text
instead of instructing the model to preserve the pose in the image, and it never
declares the reference's role. The model treated the render as inspiration and
the text as specification — exactly the inverse of what is wanted.

## Back views

Back views tend to trip the moderation filter when the base render is a nude
body. When that happens, the recorded workaround is to add the already-dressed
front view to the references and ask for parity with it, which gives the model a
clothed target instead of a nude body.
