<script lang="ts">
  /**
   * MainGrid - Debug Grid Overlay
   *
   * Press Shift+G to toggle visibility.
   * Shows an 8-column grid overlay matching your CSS grid layout.
   */

  let isVisible = $state(false)

  function handleKeydown(event: KeyboardEvent) {
    if (event.key.toLowerCase() === 'g' && event.shiftKey) {
      isVisible = !isVisible
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="grid-overlay" class:grid-overlay--visible={isVisible} aria-hidden="true">
  <div class="grid-overlay__columns">
    <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
    {#each Array(8) as _, i (i)}
      <div class="grid-overlay__col"></div>
    {/each}
  </div>
</div>

<style>
  .grid-overlay {
    position: fixed;
    top: 0;
    left: 0;
    opacity: 0;
    z-index: var(--z-overlay);
    transition: opacity 0.2s ease;
    width: 100vw;
    height: 100vh; /* fallback for browsers without svh support */
    height: 100svh;
    pointer-events: none;
  }

  .grid-overlay--visible {
    opacity: 1;
  }

  .grid-overlay__columns {
    display: grid;
    position: relative;
    grid-template-columns: repeat(8, 1fr);
    gap: var(--main-grid-gap, 16px);
    margin-inline: var(--main-grid-margin, 24px);
    width: calc(100vw - var(--main-grid-margin, 24px) * 2);
    height: 100svh;
  }

  .grid-overlay__col {
    position: relative;
    background-color: rgba(0, 150, 255, 0.1);
    height: 100vh; /* fallback for browsers without svh support */
    height: 100svh;
  }
</style>
