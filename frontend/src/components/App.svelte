<script lang="ts">
  import { onMount } from 'svelte'

  import { syncLenisWithScrollTrigger } from '@/scripts/gsap'
  import { initLenis } from '@/scripts/lenis'

  onMount(() => {
    initLenis()
    syncLenisWithScrollTrigger()
  })
</script>
