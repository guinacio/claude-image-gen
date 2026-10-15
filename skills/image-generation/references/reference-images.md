# Reference Images

`--reference-images` (`referenceImages` in the MCP tool) accepts up to 5 images. Reference images are as strong a signal as the prompt itself, so choose them on purpose. The notes below come from iterating on game-environment concept art with OpenAI models; most also apply to Gemini.

## Composition from a blockout render

To control layout, camera and scale, render a simple grey blockout of the scene from the camera you want and pass it as a reference:

- Paint each key element as a flat, saturated placeholder color (one color per element) and say in the prompt what each color becomes: "the GREEN block is a tree-trunk archway, the PURPLE block is a crescent-moon archway".
- Put a human figure and a few small objects at real size in the render. They anchor the scale far better than any number in the prompt.
- Ask the model to match the camera, framing, shape and the position and size of every placeholder, and to take everything else from the description.
- Render at the output size and aspect ratio (for example `1536x1024` for `3:2` on OpenAI), so the model does not crop or reframe the composition.
- Use an opaque background. A transparent render can be read as black or noise; flatten it onto a neutral grey first.

## Every reference gets copied

The model treats references as content to keep, not as loose inspiration:

- A previous concept passed as a reference makes the new image a near copy of it, including the parts you wanted to change. To explore new ideas, pass only the composition reference and describe the rest in text.
- To refine an approved image instead, pass it as the reference and list the changes, saying what must stay the same.
- Name each reference by number and role in the prompt ("image 1 is the layout blockout, image 2 shows the style"), as OpenAI's [image prompting guide](https://developers.openai.com/api/docs/guides/image-prompting) recommends.

## Write long, specific prompts

Short bullet lists of features produce generic results. What worked was describing each element in full: material, color, size, how many, where it sits, how it is lit, and the overall mood, in labeled sections (composition, style and materials, each element, light, rendering). A prompt of several paragraphs is normal for a detailed scene.

## Describe, don't name

- Describe a look instead of naming a copyrighted character or franchise as the style. "In the style of Tinker Bell" produced a recognizable lookalike, which is a problem for commercial use; "a small fairy with short blonde hair and a leaf dress" did not.
- Ask for effects as large, defined shapes ("glowing rune rings circling the statue", "broad beams of colored light from the windows"). Vague words like "magical sparkles" or "fairy dust" tend to scatter tiny glints over the whole image, a common giveaway of AI-generated art.

## Confirm before paying

Each generation is billed. Before running one, show the user the full prompt, the model and the list of reference images (each file and what it is for), and generate after they agree. A wrong reference costs a whole generation.
