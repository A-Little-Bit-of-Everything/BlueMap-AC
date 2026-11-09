<template>
  <div v-if="worldState.hasData && worldState.skyLight"
       class="world-time"
       :class="{ active: worldState.liveDaylight }"
       :title="tooltip"
       @click="toggleLive">
    <div class="time-icon">
      <svg v-if="worldState.isDay" viewBox="0 0 30 30" class="sun-icon">
        <circle cx="15" cy="15" r="6"/>
        <line x1="15" y1="2" x2="15" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="15" y1="25" x2="15" y2="28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="2" y1="15" x2="5" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="25" y1="15" x2="28" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="5.8" y1="5.8" x2="7.9" y2="7.9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="22.1" y1="22.1" x2="24.2" y2="24.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="5.8" y1="24.2" x2="7.9" y2="22.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="22.1" y1="7.9" x2="24.2" y2="5.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <svg v-else viewBox="0 0 30 30" class="moon-icon">
        <path d="M17.011,19.722c-3.778-1.613-5.533-5.982-3.921-9.76c0.576-1.348,1.505-2.432,2.631-3.204
          c-3.418-0.243-6.765,1.664-8.186,4.992c-1.792,4.197,0.159,9.053,4.356,10.844c3.504,1.496,7.462,0.377,9.717-2.476
          C20.123,20.465,18.521,20.365,17.011,19.722z"/>
      </svg>
    </div>
    <span class="time-text">{{ worldState.formattedTime }}</span>
    <span v-if="worldState.liveDaylight" class="live-dot" title="Live"></span>
  </div>
</template>

<script>
export default {
  name: "WorldTime",
  data() {
    return {
      worldState: this.$bluemap.worldState.data
    };
  },
  computed: {
    tooltip() {
      let state = this.worldState.liveDaylight ? "Active" : "Paused";
      return `${this.$t('lighting.liveDaylight')}: ${this.worldState.formattedTime} (${state})`;
    }
  },
  methods: {
    toggleLive(evt) {
      evt.preventDefault();
      this.$bluemap.setLiveDaylight(!this.worldState.liveDaylight);
    }
  }
};
</script>

<style lang="scss">
.world-time {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.4em;
  padding: 0 0.6em;
  height: 2em;
  background-color: var(--theme-bg);
  color: var(--theme-fg);
  font-size: 0.85em;
  font-weight: 500;
  user-select: none;
  cursor: pointer;
  pointer-events: auto;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--theme-bg-hover);
  }

  &.active {
    color: var(--theme-fg-light);
  }

  .time-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.4em;
    height: 1.4em;

    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;

      &.sun-icon {
        color: #f7b731;
        circle { fill: #f7b731; }
      }

      &.moon-icon {
        color: #a5b1c2;
        path { fill: #a5b1c2; }
      }
    }
  }

  .time-text {
    font-variant-numeric: tabular-nums;
    font-family: inherit;
    letter-spacing: 0.05em;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #20bf6b;
    box-shadow: 0 0 4px #20bf6b;
  }
}
</style>
