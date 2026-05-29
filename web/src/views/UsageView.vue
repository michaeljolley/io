<script setup lang="ts">
  import { ref, onMounted, computed } from "vue";
  import { apiGet, apiPut } from "@/lib/api";
  import { BarChart3, TrendingUp, Users, Bot, AlertTriangle, DollarSign } from "lucide-vue-next";

  const loading = ref(true);
  const activeTab = ref("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "by-squad", label: "By Squad" },
    { id: "by-agent", label: "By Agent" },
    { id: "daily", label: "Daily Trend" },
    { id: "pricing", label: "Pricing" },
  ];

  const summary = ref<{
    total_records: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    total_cost_usd: number;
  } | null>(null);

  const bySquad = ref<
    {
      id: string;
      name: string;
      total_input_tokens: number;
      total_output_tokens: number;
      total_tokens: number;
      total_cost_usd: number;
      record_count: number;
    }[]
  >([]);

  const byAgent = ref<
    {
      id: string;
      name: string;
      total_input_tokens: number;
      total_output_tokens: number;
      total_tokens: number;
      total_cost_usd: number;
      record_count: number;
    }[]
  >([]);

  const daily = ref<
    {
      date: string;
      total_input_tokens: number;
      total_output_tokens: number;
      total_tokens: number;
      total_cost_usd: number;
    }[]
  >([]);

  const pricing = ref<Record<string, { inputPer1M: number; outputPer1M: number }>>({});
  const tokenAlertThreshold = ref<number | null>(null);
  const savingThreshold = ref(false);
  const savedThreshold = ref(false);
  const savingPricing = ref(false);
  const savedPricing = ref(false);
  const editingPricingModel = ref("");
  const editingPricingInput = ref(0);
  const editingPricingOutput = ref(0);

  async function loadData() {
    loading.value = true;
    try {
      const [s, sq, ag, d, pr, alertData] = await Promise.all([
        apiGet("/token-usage/summary"),
        apiGet("/token-usage/by-squad"),
        apiGet("/token-usage/by-agent"),
        apiGet("/token-usage/daily?days=30"),
        apiGet("/token-usage/pricing"),
        apiGet("/token-usage/alert-threshold"),
      ]);
      summary.value = s;
      bySquad.value = sq.filter((r: any) => r.record_count > 0);
      byAgent.value = ag.filter((r: any) => r.record_count > 0);
      daily.value = d;
      pricing.value = pr;
      tokenAlertThreshold.value = alertData.tokenAlertThreshold;
    } finally {
      loading.value = false;
    }
  }

  async function saveThreshold() {
    savingThreshold.value = true;
    savedThreshold.value = false;
    try {
      await apiPut("/token-usage/alert-threshold", {
        tokenAlertThreshold: tokenAlertThreshold.value,
      });
      savedThreshold.value = true;
      setTimeout(() => (savedThreshold.value = false), 2000);
    } finally {
      savingThreshold.value = false;
    }
  }

  function startEditPricing(model: string) {
    editingPricingModel.value = model;
    editingPricingInput.value = pricing.value[model]?.inputPer1M ?? 0;
    editingPricingOutput.value = pricing.value[model]?.outputPer1M ?? 0;
  }

  async function savePricing() {
    if (!editingPricingModel.value) return;
    savingPricing.value = true;
    savedPricing.value = false;
    try {
      const updated = {
        ...pricing.value,
        [editingPricingModel.value]: {
          inputPer1M: editingPricingInput.value,
          outputPer1M: editingPricingOutput.value,
        },
      };
      await apiPut("/token-usage/pricing", updated);
      pricing.value = updated;
      editingPricingModel.value = "";
      savedPricing.value = true;
      setTimeout(() => (savedPricing.value = false), 2000);
    } finally {
      savingPricing.value = false;
    }
  }

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function formatCost(n: number): string {
    if (n < 0.0001) return "$0.00";
    if (n < 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
  }

  const maxDailyTokens = computed(() => Math.max(1, ...daily.value.map((d) => d.total_tokens)));

  onMounted(loadData);
</script>

<template>
  <div class="p-6">
    <div class="flex items-center gap-3 mb-6">
      <BarChart3 class="w-6 h-6 text-primary" />
      <h1 class="text-2xl font-bold">Token Usage</h1>
    </div>

    <div v-if="loading" class="text-muted-foreground">Loading...</div>

    <template v-else>
      <!-- Tabs -->
      <div class="flex gap-1 border-b border-border mb-6">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          :class="
            activeTab === tab.id
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Overview -->
      <div v-if="activeTab === 'overview'" class="space-y-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="border border-border rounded-lg p-4">
            <div class="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp class="w-3 h-3" /> Total Tokens
            </div>
            <div class="text-2xl font-bold">{{ formatTokens(summary?.total_tokens ?? 0) }}</div>
            <div class="text-xs text-muted-foreground mt-1">
              {{ formatTokens(summary?.total_input_tokens ?? 0) }} in /
              {{ formatTokens(summary?.total_output_tokens ?? 0) }} out
            </div>
          </div>
          <div class="border border-border rounded-lg p-4">
            <div class="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign class="w-3 h-3" /> Est. Cost
            </div>
            <div class="text-2xl font-bold">{{ formatCost(summary?.total_cost_usd ?? 0) }}</div>
            <div class="text-xs text-muted-foreground mt-1">all time</div>
          </div>
          <div class="border border-border rounded-lg p-4">
            <div class="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users class="w-3 h-3" /> Active Squads
            </div>
            <div class="text-2xl font-bold">{{ bySquad.length }}</div>
            <div class="text-xs text-muted-foreground mt-1">with usage</div>
          </div>
          <div class="border border-border rounded-lg p-4">
            <div class="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Bot class="w-3 h-3" /> Active Agents
            </div>
            <div class="text-2xl font-bold">{{ byAgent.length }}</div>
            <div class="text-xs text-muted-foreground mt-1">with usage</div>
          </div>
        </div>

        <!-- Alert threshold status -->
        <div
          v-if="tokenAlertThreshold !== null"
          class="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3"
        >
          <AlertTriangle class="w-4 h-4 shrink-0" />
          Alert threshold active: {{ formatTokens(tokenAlertThreshold) }} tokens per task
        </div>

        <!-- Top squads -->
        <div v-if="bySquad.length > 0">
          <h2 class="text-base font-semibold mb-3">Top Squads by Token Usage</h2>
          <div class="border border-border rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="text-left px-4 py-2 font-medium">Squad</th>
                  <th class="text-right px-4 py-2 font-medium">Tokens</th>
                  <th class="text-right px-4 py-2 font-medium">Est. Cost</th>
                  <th class="text-right px-4 py-2 font-medium">Calls</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sq in bySquad.slice(0, 5)" :key="sq.id" class="border-t border-border">
                  <td class="px-4 py-2 font-medium">{{ sq.name }}</td>
                  <td class="px-4 py-2 text-right text-muted-foreground">
                    {{ formatTokens(sq.total_tokens) }}
                  </td>
                  <td class="px-4 py-2 text-right text-muted-foreground">
                    {{ formatCost(sq.total_cost_usd) }}
                  </td>
                  <td class="px-4 py-2 text-right text-muted-foreground">{{ sq.record_count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="summary?.total_records === 0" class="text-sm text-muted-foreground">
          No token usage recorded yet. Usage will appear here after squads or agents complete tasks.
        </div>
      </div>

      <!-- By Squad -->
      <div v-if="activeTab === 'by-squad'">
        <div v-if="bySquad.length === 0" class="text-sm text-muted-foreground">
          No usage data yet.
        </div>
        <div v-else class="border border-border rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-muted">
              <tr>
                <th class="text-left px-4 py-2 font-medium">Squad</th>
                <th class="text-right px-4 py-2 font-medium">Input Tokens</th>
                <th class="text-right px-4 py-2 font-medium">Output Tokens</th>
                <th class="text-right px-4 py-2 font-medium">Total Tokens</th>
                <th class="text-right px-4 py-2 font-medium">Est. Cost</th>
                <th class="text-right px-4 py-2 font-medium">API Calls</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sq in bySquad" :key="sq.id" class="border-t border-border">
                <td class="px-4 py-2 font-medium">{{ sq.name }}</td>
                <td class="px-4 py-2 text-right text-muted-foreground">
                  {{ formatTokens(sq.total_input_tokens) }}
                </td>
                <td class="px-4 py-2 text-right text-muted-foreground">
                  {{ formatTokens(sq.total_output_tokens) }}
                </td>
                <td class="px-4 py-2 text-right font-medium">
                  {{ formatTokens(sq.total_tokens) }}
                </td>
                <td class="px-4 py-2 text-right text-muted-foreground">
                  {{ formatCost(sq.total_cost_usd) }}
                </td>
                <td class="px-4 py-2 text-right text-muted-foreground">{{ sq.record_count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- By Agent -->
      <div v-if="activeTab === 'by-agent'">
        <div v-if="byAgent.length === 0" class="text-sm text-muted-foreground">
          No usage data yet.
        </div>
        <div v-else class="border border-border rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-muted">
              <tr>
                <th class="text-left px-4 py-2 font-medium">Agent</th>
                <th class="text-right px-4 py-2 font-medium">Input Tokens</th>
                <th class="text-right px-4 py-2 font-medium">Output Tokens</th>
                <th class="text-right px-4 py-2 font-medium">Total Tokens</th>
                <th class="text-right px-4 py-2 font-medium">Est. Cost</th>
                <th class="text-right px-4 py-2 font-medium">API Calls</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ag in byAgent" :key="ag.id" class="border-t border-border">
                <td class="px-4 py-2 font-medium">{{ ag.name }}</td>
                <td class="px-4 py-2 text-right text-muted-foreground">
                  {{ formatTokens(ag.total_input_tokens) }}
                </td>
                <td class="px-4 py-2 text-right text-muted-foreground">
                  {{ formatTokens(ag.total_output_tokens) }}
                </td>
                <td class="px-4 py-2 text-right font-medium">
                  {{ formatTokens(ag.total_tokens) }}
                </td>
                <td class="px-4 py-2 text-right text-muted-foreground">
                  {{ formatCost(ag.total_cost_usd) }}
                </td>
                <td class="px-4 py-2 text-right text-muted-foreground">{{ ag.record_count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Daily Trend -->
      <div v-if="activeTab === 'daily'">
        <div v-if="daily.length === 0" class="text-sm text-muted-foreground">
          No usage data yet.
        </div>
        <template v-else>
          <!-- Bar chart -->
          <div class="mb-6">
            <h2 class="text-base font-semibold mb-3">Last 30 Days — Token Usage</h2>
            <div class="flex items-end gap-1 h-32 border border-border rounded-lg p-3 bg-muted/20">
              <div
                v-for="d in daily"
                :key="d.date"
                class="flex-1 bg-primary/60 rounded-t min-w-[4px] relative group"
                :style="{ height: `${(d.total_tokens / maxDailyTokens) * 100}%` }"
              >
                <div
                  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover border border-border text-xs rounded px-2 py-1 whitespace-nowrap z-10"
                >
                  {{ d.date }}: {{ formatTokens(d.total_tokens) }} tokens ({{
                    formatCost(d.total_cost_usd)
                  }})
                </div>
              </div>
            </div>
          </div>

          <div class="border border-border rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="text-left px-4 py-2 font-medium">Date</th>
                  <th class="text-right px-4 py-2 font-medium">Input Tokens</th>
                  <th class="text-right px-4 py-2 font-medium">Output Tokens</th>
                  <th class="text-right px-4 py-2 font-medium">Total Tokens</th>
                  <th class="text-right px-4 py-2 font-medium">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in [...daily].reverse()" :key="d.date" class="border-t border-border">
                  <td class="px-4 py-2 font-mono text-xs">{{ d.date }}</td>
                  <td class="px-4 py-2 text-right text-muted-foreground">
                    {{ formatTokens(d.total_input_tokens) }}
                  </td>
                  <td class="px-4 py-2 text-right text-muted-foreground">
                    {{ formatTokens(d.total_output_tokens) }}
                  </td>
                  <td class="px-4 py-2 text-right font-medium">
                    {{ formatTokens(d.total_tokens) }}
                  </td>
                  <td class="px-4 py-2 text-right text-muted-foreground">
                    {{ formatCost(d.total_cost_usd) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <!-- Pricing -->
      <div v-if="activeTab === 'pricing'" class="space-y-6">
        <div>
          <h2 class="text-base font-semibold mb-1">Alert Threshold</h2>
          <p class="text-sm text-muted-foreground mb-3">
            Post a feed alert when a single task exceeds this many tokens. Leave empty to disable.
          </p>
          <div class="flex items-center gap-3 max-w-sm">
            <input
              v-model.number="tokenAlertThreshold"
              type="number"
              min="0"
              placeholder="e.g. 100000"
              class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              @click="saveThreshold"
              :disabled="savingThreshold"
              class="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 shrink-0"
            >
              {{ savingThreshold ? "Saving..." : savedThreshold ? "Saved ✓" : "Save" }}
            </button>
          </div>
        </div>

        <div>
          <h2 class="text-base font-semibold mb-1">Model Pricing</h2>
          <p class="text-sm text-muted-foreground mb-3">
            Prices in USD per 1M tokens. Used for cost estimates only.
          </p>

          <!-- Edit form -->
          <div
            v-if="editingPricingModel"
            class="border border-border rounded-lg p-4 mb-4 max-w-md space-y-3"
          >
            <div class="font-medium text-sm">
              Editing: <code class="bg-muted px-1 rounded">{{ editingPricingModel }}</code>
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="text-xs text-muted-foreground">Input (per 1M tokens)</label>
                <input
                  v-model.number="editingPricingInput"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div class="flex-1">
                <label class="text-xs text-muted-foreground">Output (per 1M tokens)</label>
                <input
                  v-model.number="editingPricingOutput"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div class="flex gap-2">
              <button
                @click="savePricing"
                :disabled="savingPricing"
                class="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {{ savingPricing ? "Saving..." : savedPricing ? "Saved ✓" : "Save" }}
              </button>
              <button
                @click="editingPricingModel = ''"
                class="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>

          <div class="border border-border rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="text-left px-4 py-2 font-medium">Model</th>
                  <th class="text-right px-4 py-2 font-medium">Input / 1M tokens</th>
                  <th class="text-right px-4 py-2 font-medium">Output / 1M tokens</th>
                  <th class="text-right px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(p, model) in pricing" :key="model" class="border-t border-border">
                  <td class="px-4 py-2 font-mono text-xs">{{ model }}</td>
                  <td class="px-4 py-2 text-right text-muted-foreground">
                    ${{ p.inputPer1M.toFixed(2) }}
                  </td>
                  <td class="px-4 py-2 text-right text-muted-foreground">
                    ${{ p.outputPer1M.toFixed(2) }}
                  </td>
                  <td class="px-4 py-2 text-right">
                    <button
                      @click="startEditPricing(model as string)"
                      class="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
