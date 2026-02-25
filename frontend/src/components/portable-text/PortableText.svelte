<script lang="ts">
  import type { InputValue, PortableTextComponents } from '@portabletext/svelte'
  import { PortableText } from '@portabletext/svelte'
  import { Code, Em, Link, Strong } from './marks'

  interface Props {
    /** Portable Text block content array from Sanity GROQ queries */
    value: unknown[] | null | undefined
    /** Additional CSS class(es) */
    class?: string
  }

  let { value, class: className = '' }: Props = $props()

  /** Cast to the library's expected type — Sanity's codegen types are structurally compatible */
  let ptValue = $derived(value as InputValue)

  /**
   * Custom components for rendering Portable Text marks & annotations.
   * To add a new annotation (e.g. highlight):
   * 1. Create a Svelte component in ./marks/
   * 2. Export it from ./marks/index.ts
   * 3. Add it to the `marks` object below
   */
  const components: PortableTextComponents = {
    marks: {
      // Decorators
      strong: Strong,
      em: Em,
      code: Code,
      // Annotations (sanity-plugin-link-field)
      link: Link,
    },
  }
</script>

{#if value && value.length > 0}
  <div class="portable-text {className}">
    <PortableText value={ptValue} {components} />
  </div>
{/if}

<style>
  .portable-text :global(h1) {
    font-size: var(--text-36);
    margin-bottom: var(--size-16);
  }

  .portable-text :global(h2) {
    font-size: var(--text-24);
    margin-top: var(--size-32);
    margin-bottom: var(--size-12);
  }

  .portable-text :global(h3) {
    font-size: var(--text-20);
    margin-top: var(--size-24);
    margin-bottom: var(--size-8);
  }

  .portable-text :global(h4) {
    font-size: var(--text-18);
    margin-top: var(--size-24);
    margin-bottom: var(--size-8);
  }

  .portable-text :global(p) {
    font-size: var(--text-16);
    line-height: 1.7;
    margin-bottom: var(--size-16);
    opacity: 0.8;
  }

  .portable-text :global(blockquote) {
    border-left: 2px solid currentColor;
    padding-left: var(--size-16);
    opacity: 0.7;
    margin: var(--size-16) 0;
  }

  .portable-text :global(ul),
  .portable-text :global(ol) {
    padding-left: var(--size-24);
    margin-bottom: var(--size-16);
  }

  .portable-text :global(li) {
    font-size: var(--text-16);
    line-height: 1.7;
    margin-bottom: var(--size-4);
    opacity: 0.8;
  }

  .portable-text :global(strong) {
    font-weight: var(--font-weight-bold, 700);
  }

  .portable-text :global(em) {
    font-style: italic;
  }

  .portable-text :global(code) {
    font-family: monospace;
    font-size: 0.9em;
    padding: 0.1em 0.3em;
    border-radius: 3px;
    background: color-mix(in srgb, currentColor 10%, transparent);
  }

  .portable-text :global(a) {
    text-decoration: underline;
    text-underline-offset: 0.2em;
    transition: opacity var(--transition-fast, 0.15s ease);
  }

  .portable-text :global(a:hover) {
    opacity: 0.7;
  }
</style>
