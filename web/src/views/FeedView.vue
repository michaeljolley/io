<template>
  <div class="relative flex flex-col h-full p-3 sm:p-6">
    <!-- Header -->
    <div class="flex justify-between items-start mb-4">
      <div>
        <h2 class="text-xl font-semibold text-txt-primary tracking-tight">Feed</h2>
        <p class="text-xs text-txt-muted mt-0.5">Messages, results &amp; notifications</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <!-- Select all / Deselect all (only in select mode) -->
        <button
          v-if="selectMode && filtered.length > 0"
          @click="toggleSelectAll"
          class="text-xs text-txt-secondary hover:text-txt-primary transition-colors font-medium"
        >
          {{ allSelected ? 'Deselect all' : 'Select all' }}
        </button>
        <!-- Mark all read (hidden in select mode) -->
        <button
          v-if="!selectMode && entries.length > 0"
          @click="markAllRead"
          class="text-xs text-accent hover:text-accent-glow transition-colors font-medium"
        >
          Mark all read
        </button>
        <!-- Select / Cancel toggle -->
        <button
          v-if="entries.length > 0"
          @click="toggleSelectMode"
          class="text-xs px-2.5 py-1 rounded-lg border transition-all duration-150 font-medium"
          :class="selectMode
            ? 'text-accent border-accent/30 bg-accent/10 hover:bg-accent/20'
            : 'text-txt-muted border-edge hover:text-txt-secondary hover:border-edge-bright hover:bg-surface-3/40'"
        >
          {{ selectMode ? 'Cancel' : 'Select' }}
        </button>
      </div>
    </div>

    <!-- Search bar -->
    <div class="relative mb-3">
      <div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-txt-muted">
        <FluentIcon
          :paths='`<path d="M13.74 13.03a7.5 7.5 0 1 0-.71.71l3.63 3.63c.2.2.51.2.71 0a.5.5 0 0 0 0-.71l-3.63-3.63Zm.26-5.53a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"/>`'
          :size="14"
        />
      </div>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search feed…"
        class="w-full pl-8 pr-8 py-2 text-xs bg-surface-2/50 border border-edge rounded-xl text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent/40 focus:bg-surface-2 transition-all duration-150"
      />
      <button
        v-if="searchQuery"
        @click="searchQuery = ''"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-txt-muted hover:text-txt-primary transition-colors"
        title="Clear search"
      >
        <FluentIcon
          :paths='`<path d="m4.09 4.22.06-.07a.5.5 0 0 1 .63-.06l.07.06L10 9.29l5.15-5.14a.5.5 0 0 1 .63-.06l.07.06c.18.17.2.44.06.63l-.06.07L10.71 10l5.14 5.15c.18.17.2.44.06.63l-.06.07a.5.5 0 0 1-.63.06l-.07-.06L10 10.71l-5.15 5.14a.5.5 0 0 1-.63.06l-.07-.06a.5.5 0 0 1-.06-.63l.06-.07L9.29 10 4.15 4.85a.5.5 0 0 1-.06-.63l.06-.07-.06.07Z"/>`'
          :size="12"
        />
      </button>
    </div>

    <!-- Filter tabs + Group-by-team toggle -->
    <div class="flex gap-1.5 mb-4 p-1 bg-surface-2/50 rounded-xl border border-edge">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        @click="activeTab = tab.value"
        class="flex-1 text-xs font-medium py-1.5 px-3 rounded-lg transition-all duration-150"
        :class="activeTab === tab.value
          ? 'bg-accent/10 text-accent border border-accent/20'
          : 'text-txt-muted hover:text-txt-secondary hover:bg-surface-3/50 border border-transparent'"
      >
        {{ tab.label }}
        <span
          v-if="tab.value !== 'all' && tabCount(tab.value) > 0"
          class="ml-1 font-mono text-[10px] opacity-70"
        >({{ tabCount(tab.value) }})</span>
      </button>
      <!-- Group by team toggle -->
      <button
        @click="groupByTeam = !groupByTeam"
        class="flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg transition-all duration-150 shrink-0"
        :class="groupByTeam
          ? 'bg-accent/10 text-accent border border-accent/20'
          : 'text-txt-muted hover:text-txt-secondary hover:bg-surface-3/50 border border-transparent'"
        title="Group by team"
      >
        <FluentIcon
          :paths='`<path d="M8 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-5 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10-1a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM8 9.5a.5.5 0 0 1 .5.5v1h4a.5.5 0 0 1 .5.5v1h1.5a.5.5 0 0 1 0 1H14v1a.5.5 0 0 1-1 0v-3.5H7v3.5a.5.5 0 0 1-1 0v-1H4.5a.5.5 0 0 1 0-1H6v-1a.5.5 0 0 1 .5-.5h1V10a.5.5 0 0 1 .5-.5Z"/>`'
          :size="12"
        />
        Team
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="flex items-center gap-3 text-txt-muted text-sm">
        <div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
        Loading…
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filtered.length === 0" class="flex-1 flex flex-col items-center justify-center">
      <div class="w-14 h-14 rounded-xl bg-surface-2 border border-edge flex items-center justify-center mb-4">
        <FluentIcon
          :paths='`<path d="M10 2a5.92 5.92 0 0 1 5.98 5.36l.02.22V11.4l.92 2.22a1 1 0 0 1 .06.17l.01.08.01.13a1 1 0 0 1-.75.97l-.11.02L16 15h-3.5v.17a2.5 2.5 0 0 1-5 0V15H4a1 1 0 0 1-.26-.03l-.13-.04a1 1 0 0 1-.6-1.05l.02-.13.05-.13L4 11.4V7.57A5.9 5.9 0 0 1 10 2Zm1.5 13h-3v.15a1.5 1.5 0 0 0 1.36 1.34l.14.01c.78 0 1.42-.6 1.5-1.36V15ZM10 3a4.9 4.9 0 0 0-4.98 4.38L5 7.6V11.5l-.04.2L4 14h12l-.96-2.3-.04-.2V7.61A4.9 4.9 0 0 0 10 3Z"/>`'
          :size="28"
          class="text-txt-muted"
        />
      </div>
      <p class="text-txt-muted text-sm font-medium">Nothing here yet</p>
      <p class="text-txt-muted/60 text-xs mt-1">
        {{ activeTab === 'all' ? 'Your feed is empty' : activeTab === 'deliverable' ? 'No deliverables' : 'No notifications' }}
      </p>
    </div>

    <!-- Entry list (flat, no grouping) -->
    <ul v-else-if="!groupByTeam" class="space-y-2 overflow-y-auto flex-1 pr-1" :class="selectMode && selected.size > 0 ? 'pb-16' : ''">
      <li
        v-for="entry in filtered"
        :key="entry.id"
        class="group bg-surface-2/50 border border-edge rounded-xl hover:border-edge-bright hover:shadow-card transition-all duration-200 overflow-hidden animate-fade-in"
        :class="[
          entry.read_at ? '' : 'glow-inner',
          selectMode && selected.has(entry.id) ? 'ring-1 ring-accent/40 bg-accent/5 border-accent/30' : ''
        ]"
      >
        <div
          class="flex items-start gap-3 p-4 cursor-pointer"
          @click="selectMode ? toggleSelect(entry.id) : toggleExpand(entry.id)"
        >
          <div v-if="selectMode" class="mt-0.5 shrink-0" @click.stop="toggleSelect(entry.id)">
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150"
              :class="selected.has(entry.id) ? 'border-accent bg-accent shadow-glow-sm' : 'border-edge hover:border-accent/60'"
            >
              <FluentIcon v-if="selected.has(entry.id)" :paths='`<path d="M3.37 10.17a.5.5 0 0 0-.74.66l4 4.5c.19.22.52.23.72.02l10.5-10.5a.5.5 0 0 0-.7-.7L7.02 14.27l-3.65-4.1Z"/>`' :size="11" class="text-surface-0" />
            </div>
          </div>
          <div class="mt-0.5 shrink-0">
            <FluentIcon v-if="entry.type === 'deliverable'" :paths='`<path d="M6 3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm10 7h-3.5a.5.5 0 0 0-.5.5v.01a1.75 1.75 0 0 1-.03.3c-.04.2-.1.46-.23.72-.13.25-.3.49-.57.66-.26.18-.63.31-1.17.31-.54 0-.9-.13-1.17-.3a1.7 1.7 0 0 1-.57-.67A2.57 2.57 0 0 1 8 10.5v-.01a.5.5 0 0 0-.5-.5H4V6c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v4ZM4 11h3.05c.05.26.14.62.32.97.18.38.47.76.9 1.06.45.29 1.02.47 1.73.47s1.28-.18 1.72-.47c.44-.3.73-.68.91-1.06.18-.35.27-.7.32-.97H16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3Z"/>`' :size="16" :class="entry.read_at ? 'text-txt-muted' : 'text-accent'" />
            <FluentIcon v-else :paths='`<path d="M10 2a5.92 5.92 0 0 1 5.98 5.36l.02.22V11.4l.92 2.22a1 1 0 0 1 .06.17l.01.08.01.13a1 1 0 0 1-.75.97l-.11.02L16 15h-3.5v.17a2.5 2.5 0 0 1-5 0V15H4a1 1 0 0 1-.26-.03l-.13-.04a1 1 0 0 1-.6-1.05l.02-.13.05-.13L4 11.4V7.57A5.9 5.9 0 0 1 10 2Zm1.5 13h-3v.15a1.5 1.5 0 0 0 1.36 1.34l.14.01c.78 0 1.42-.6 1.5-1.36V15ZM10 3a4.9 4.9 0 0 0-4.98 4.38L5 7.6V11.5l-.04.2L4 14h12l-.96-2.3-.04-.2V7.61A4.9 4.9 0 0 0 10 3Z"/>`' :size="16" :class="entry.read_at ? 'text-txt-muted' : 'text-accent'" />
          </div>
          <span v-if="!entry.read_at" class="mt-2 w-1.5 h-1.5 rounded-full bg-accent shadow-glow-sm shrink-0"></span>
          <span v-else class="mt-2 w-1.5 h-1.5 rounded-full bg-edge shrink-0"></span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-sm font-semibold text-txt-primary truncate leading-snug">{{ entry.title }}</span>
              <span v-if="entry.source_type" class="text-[10px] font-mono tracking-wider uppercase text-txt-muted bg-surface-0/60 px-1.5 py-0.5 rounded border border-edge/50 shrink-0">{{ entry.source_type }}</span>
            </div>
            <p class="text-[10px] text-txt-muted mb-1">{{ formatTime(entry.created_at) }}</p>
            <p v-if="!expanded.has(entry.id)" class="text-xs text-txt-secondary line-clamp-2 leading-relaxed">{{ bodyPreview(entry.body) }}</p>
          </div>
          <div v-if="!selectMode" class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button v-if="!entry.read_at" @click.stop="markRead(entry.id)" class="p-1.5 rounded-lg text-txt-muted hover:text-accent hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all duration-150" title="Mark as read">
              <FluentIcon :paths='`<path d="M3.37 10.17a.5.5 0 0 0-.74.66l4 4.5c.19.22.52.23.72.02l10.5-10.5a.5.5 0 0 0-.7-.7L7.02 14.27l-3.65-4.1Z"/>`' :size="14" />
            </button>
            <button @click.stop="deleteEntry(entry.id)" :disabled="deleting.has(entry.id)" class="p-1.5 rounded-lg text-txt-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 disabled:opacity-30 transition-all duration-150" title="Delete">
              <FluentIcon :paths='`<path d="M8.5 4h3a1.5 1.5 0 0 0-3 0Zm-1 0a2.5 2.5 0 0 1 5 0h5a.5.5 0 0 1 0 1h-1.05l-1.2 10.34A3 3 0 0 1 12.27 18H7.73a3 3 0 0 1-2.98-2.66L3.55 5H2.5a.5.5 0 0 1 0-1h5ZM5.74 15.23A2 2 0 0 0 7.73 17h4.54a2 2 0 0 0 1.99-1.77L15.44 5H4.56l1.18 10.23ZM8.5 7.5c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V8c0-.28.22-.5.5-.5ZM12 8a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V8Z"/>`' :size="14" />
            </button>
          </div>
        </div>
        <div v-if="!selectMode && expanded.has(entry.id)" class="px-4 pb-4">
          <div class="text-sm text-txt-secondary bg-surface-0/60 rounded-xl p-4 border border-edge/50 wiki-content leading-relaxed" v-html="renderMarkdown(entry.body)"></div>
        </div>
      </li>
    </ul>

    <!-- Grouped entry list -->
    <div v-else class="space-y-3 overflow-y-auto flex-1 pr-1" :class="selectMode && selected.size > 0 ? 'pb-16' : ''">
      <div v-for="group in groupedEntries" :key="group.key">
        <!-- Group header -->
        <button
          @click="toggleGroup(group.key)"
          class="w-full flex items-center gap-2 px-2 py-1.5 mb-1 text-left hover:bg-surface-3/30 rounded-lg transition-colors duration-150"
        >
          <FluentIcon
            :paths='`<path d="M7.47 4.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1-1.06 1.06L8 5.81 3.28 10.53a.75.75 0 0 1-1.06-1.06l5.25-5.25Z"/>`'
            :size="12"
            class="text-txt-muted transition-transform duration-150 shrink-0"
            :class="collapsedGroups.has(group.key) ? '-rotate-90' : 'rotate-180'"
          />
          <span class="text-xs font-semibold text-txt-secondary uppercase tracking-wider">{{ group.label }}</span>
          <span class="text-[10px] font-mono text-txt-muted">({{ group.entries.length }})</span>
        </button>
        <!-- Entries in this group -->
        <ul v-if="!collapsedGroups.has(group.key)" class="space-y-2">
          <li
            v-for="entry in group.entries"
            :key="entry.id"
            class="group bg-surface-2/50 border border-edge rounded-xl hover:border-edge-bright hover:shadow-card transition-all duration-200 overflow-hidden animate-fade-in"
            :class="[
              entry.read_at ? '' : 'glow-inner',
              selectMode && selected.has(entry.id) ? 'ring-1 ring-accent/40 bg-accent/5 border-accent/30' : ''
            ]"
          >
            <div
              class="flex items-start gap-3 p-4 cursor-pointer"
              @click="selectMode ? toggleSelect(entry.id) : toggleExpand(entry.id)"
            >
              <div v-if="selectMode" class="mt-0.5 shrink-0" @click.stop="toggleSelect(entry.id)">
                <div
                  class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150"
                  :class="selected.has(entry.id) ? 'border-accent bg-accent shadow-glow-sm' : 'border-edge hover:border-accent/60'"
                >
                  <FluentIcon v-if="selected.has(entry.id)" :paths='`<path d="M3.37 10.17a.5.5 0 0 0-.74.66l4 4.5c.19.22.52.23.72.02l10.5-10.5a.5.5 0 0 0-.7-.7L7.02 14.27l-3.65-4.1Z"/>`' :size="11" class="text-surface-0" />
                </div>
              </div>
              <div class="mt-0.5 shrink-0">
                <FluentIcon v-if="entry.type === 'deliverable'" :paths='`<path d="M6 3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm10 7h-3.5a.5.5 0 0 0-.5.5v.01a1.75 1.75 0 0 1-.03.3c-.04.2-.1.46-.23.72-.13.25-.3.49-.57.66-.26.18-.63.31-1.17.31-.54 0-.9-.13-1.17-.3a1.7 1.7 0 0 1-.57-.67A2.57 2.57 0 0 1 8 10.5v-.01a.5.5 0 0 0-.5-.5H4V6c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v4ZM4 11h3.05c.05.26.14.62.32.97.18.38.47.76.9 1.06.45.29 1.02.47 1.73.47s1.28-.18 1.72-.47c.44-.3.73-.68.91-1.06.18-.35.27-.7.32-.97H16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3Z"/>`' :size="16" :class="entry.read_at ? 'text-txt-muted' : 'text-accent'" />
                <FluentIcon v-else :paths='`<path d="M10 2a5.92 5.92 0 0 1 5.98 5.36l.02.22V11.4l.92 2.22a1 1 0 0 1 .06.17l.01.08.01.13a1 1 0 0 1-.75.97l-.11.02L16 15h-3.5v.17a2.5 2.5 0 0 1-5 0V15H4a1 1 0 0 1-.26-.03l-.13-.04a1 1 0 0 1-.6-1.05l.02-.13.05-.13L4 11.4V7.57A5.9 5.9 0 0 1 10 2Zm1.5 13h-3v.15a1.5 1.5 0 0 0 1.36 1.34l.14.01c.78 0 1.42-.6 1.5-1.36V15ZM10 3a4.9 4.9 0 0 0-4.98 4.38L5 7.6V11.5l-.04.2L4 14h12l-.96-2.3-.04-.2V7.61A4.9 4.9 0 0 0 10 3Z"/>`' :size="16" :class="entry.read_at ? 'text-txt-muted' : 'text-accent'" />
              </div>
              <span v-if="!entry.read_at" class="mt-2 w-1.5 h-1.5 rounded-full bg-accent shadow-glow-sm shrink-0"></span>
              <span v-else class="mt-2 w-1.5 h-1.5 rounded-full bg-edge shrink-0"></span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-sm font-semibold text-txt-primary truncate leading-snug">{{ entry.title }}</span>
                  <span v-if="entry.source_type" class="text-[10px] font-mono tracking-wider uppercase text-txt-muted bg-surface-0/60 px-1.5 py-0.5 rounded border border-edge/50 shrink-0">{{ entry.source_type }}</span>
                </div>
                <p class="text-[10px] text-txt-muted mb-1">{{ formatTime(entry.created_at) }}</p>
                <p v-if="!expanded.has(entry.id)" class="text-xs text-txt-secondary line-clamp-2 leading-relaxed">{{ bodyPreview(entry.body) }}</p>
              </div>
              <div v-if="!selectMode" class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button v-if="!entry.read_at" @click.stop="markRead(entry.id)" class="p-1.5 rounded-lg text-txt-muted hover:text-accent hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all duration-150" title="Mark as read">
                  <FluentIcon :paths='`<path d="M3.37 10.17a.5.5 0 0 0-.74.66l4 4.5c.19.22.52.23.72.02l10.5-10.5a.5.5 0 0 0-.7-.7L7.02 14.27l-3.65-4.1Z"/>`' :size="14" />
                </button>
                <button @click.stop="deleteEntry(entry.id)" :disabled="deleting.has(entry.id)" class="p-1.5 rounded-lg text-txt-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 disabled:opacity-30 transition-all duration-150" title="Delete">
                  <FluentIcon :paths='`<path d="M8.5 4h3a1.5 1.5 0 0 0-3 0Zm-1 0a2.5 2.5 0 0 1 5 0h5a.5.5 0 0 1 0 1h-1.05l-1.2 10.34A3 3 0 0 1 12.27 18H7.73a3 3 0 0 1-2.98-2.66L3.55 5H2.5a.5.5 0 0 1 0-1h5ZM5.74 15.23A2 2 0 0 0 7.73 17h4.54a2 2 0 0 0 1.99-1.77L15.44 5H4.56l1.18 10.23ZM8.5 7.5c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V8c0-.28.22-.5.5-.5ZM12 8a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V8Z"/>`' :size="14" />
                </button>
              </div>
            </div>
            <div v-if="!selectMode && expanded.has(entry.id)" class="px-4 pb-4">
              <div class="text-sm text-txt-secondary bg-surface-0/60 rounded-xl p-4 border border-edge/50 wiki-content leading-relaxed" v-html="renderMarkdown(entry.body)"></div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Bulk action bar -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="selectMode && selected.size > 0"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-surface-3 border border-edge-bright shadow-card backdrop-blur-sm z-20"
      >
        <span class="text-xs font-semibold text-txt-secondary mr-1 whitespace-nowrap">
          {{ selected.size }} selected
        </span>
        <button
          @click="bulkMarkRead"
          :disabled="bulkWorking"
          class="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 disabled:opacity-40 transition-all duration-150"
        >
          <FluentIcon :paths='`<path d="M3.37 10.17a.5.5 0 0 0-.74.66l4 4.5c.19.22.52.23.72.02l10.5-10.5a.5.5 0 0 0-.7-.7L7.02 14.27l-3.65-4.1Z"/>`' :size="14" />
          Mark read
        </button>
        <button
          @click="bulkDelete"
          :disabled="bulkWorking"
          class="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 transition-all duration-150"
        >
          <FluentIcon :paths='`<path d="M8.5 4h3a1.5 1.5 0 0 0-3 0Zm-1 0a2.5 2.5 0 0 1 5 0h5a.5.5 0 0 1 0 1h-1.05l-1.2 10.34A3 3 0 0 1 12.27 18H7.73a3 3 0 0 1-2.98-2.66L3.55 5H2.5a.5.5 0 0 1 0-1h5ZM5.74 15.23A2 2 0 0 0 7.73 17h4.54a2 2 0 0 0 1.99-1.77L15.44 5H4.56l1.18 10.23ZM8.5 7.5c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V8c0-.28.22-.5.5-.5ZM12 8a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V8Z"/>`' :size="14" />
          Delete
        </button>
      </div>
    </Transition>

    <!-- Error banner -->
    <div
      v-if="errorMsg"
      class="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5"
    >
      <FluentIcon :paths='`<path d="m4.09 4.22.06-.07a.5.5 0 0 1 .63-.06l.07.06L10 9.29l5.15-5.14a.5.5 0 0 1 .63-.06l.07.06c.18.17.2.44.06.63l-.06.07L10.71 10l5.14 5.15c.18.17.2.44.06.63l-.06.07a.5.5 0 0 1-.63.06l-.07-.06L10 10.71l-5.15 5.14a.5.5 0 0 1-.63.06l-.07-.06a.5.5 0 0 1-.06-.63l.06-.07L9.29 10 4.15 4.85a.5.5 0 0 1-.06-.63l.06-.07-.06.07Z"/>`' :size="16" class="shrink-0" />
      {{ errorMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import FluentIcon from '../components/FluentIcon.vue'
import { renderMarkdown } from '../lib/markdown'
import { apiFetch } from '../lib/api'

interface FeedEntry {
  id: number
  type: 'deliverable' | 'notification'
  title: string
  body: string
  source_type: string | null
  source_ref: string | null
  created_at: string
  read_at: string | null
  source?: { type?: string; [k: string]: unknown }
}

type TabValue = 'all' | 'deliverable' | 'notification'

const tabs: { label: string; value: TabValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Deliverables', value: 'deliverable' },
  { label: 'Notifications', value: 'notification' },
]

const entries = ref<FeedEntry[]>([])
const loading = ref(true)
const activeTab = ref<TabValue>('all')
const expanded = ref(new Set<number>())
const deleting = ref(new Set<number>())
const errorMsg = ref<string | null>(null)

// Search
const searchQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Group by team
const groupByTeam = ref(false)
const collapsedGroups = ref(new Set<string>())

// Bulk select state
const selectMode = ref(false)
const selected = ref(new Set<number>())
const bulkWorking = ref(false)

/** Extract squad slug from "[slug] title" format, or null if not present. */
function extractSquad(title: string): string | null {
  const m = title.match(/^\[([^\]]+)\]/)
  return m ? m[1] : null
}

const filtered = computed(() => {
  if (activeTab.value === 'all') return entries.value
  return entries.value.filter(e => e.type === activeTab.value)
})

const groupedEntries = computed(() => {
  const map = new Map<string, FeedEntry[]>()
  for (const entry of filtered.value) {
    const key = extractSquad(entry.title) ?? '__ungrouped__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(entry)
  }
  const groups: { key: string; label: string; entries: FeedEntry[] }[] = []
  for (const [key, groupEntries] of map) {
    groups.push({ key, label: key === '__ungrouped__' ? 'Ungrouped' : key, entries: groupEntries })
  }
  groups.sort((a, b) => {
    if (a.key === '__ungrouped__') return 1
    if (b.key === '__ungrouped__') return -1
    return a.key.localeCompare(b.key)
  })
  return groups
})

const allSelected = computed(() =>
  filtered.value.length > 0 && filtered.value.every(e => selected.value.has(e.id))
)

function tabCount(type: TabValue): number {
  return entries.value.filter(e => e.type === type).length
}

function formatTime(ts: string): string {
  try {
    const normalized = ts.includes('T') || ts.endsWith('Z') ? ts : ts.replace(' ', 'T') + 'Z'
    return new Date(normalized).toLocaleString()
  } catch { return ts }
}

function bodyPreview(body: string): string {
  return body.replace(/[#*`_~[\]()]/g, '').slice(0, 200)
}

function toggleExpand(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selected.value = new Set()
}

function toggleSelect(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleSelectAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(filtered.value.map(e => e.id))
  }
}

function toggleGroup(key: string) {
  const next = new Set(collapsedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedGroups.value = next
}

async function loadEntries(search?: string) {
  loading.value = true
  errorMsg.value = null
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (search) params.set('search', search)
    const res = await apiFetch(`/api/feed?${params}`)
    if (res.ok) {
      const data = (await res.json()) as { entries: FeedEntry[] }
      entries.value = data.entries ?? []
    }
  } catch { /* best effort */ }
  loading.value = false
}

async function markRead(id: number) {
  try {
    await apiFetch(`/api/feed/${id}/read`, { method: 'POST' })
    const entry = entries.value.find(e => e.id === id)
    if (entry) entry.read_at = new Date().toISOString()
  } catch { /* best effort */ }
}

async function markAllRead() {
  const typeParam = activeTab.value !== 'all' ? `?type=${activeTab.value}` : ''
  try {
    await apiFetch(`/api/feed/read-all${typeParam}`, { method: 'POST' })
    const now = new Date().toISOString()
    for (const e of entries.value) {
      if (!e.read_at && (activeTab.value === 'all' || e.type === activeTab.value)) {
        e.read_at = now
      }
    }
  } catch { /* best effort */ }
}

async function deleteEntry(id: number) {
  if (!window.confirm('Delete this entry?')) return
  const next = new Set(deleting.value)
  next.add(id)
  deleting.value = next
  try {
    const res = await apiFetch(`/api/feed/${id}`, { method: 'DELETE' })
    if (res.ok) {
      entries.value = entries.value.filter(e => e.id !== id)
      const nextExpanded = new Set(expanded.value)
      nextExpanded.delete(id)
      expanded.value = nextExpanded
    } else {
      errorMsg.value = `Failed to delete entry (HTTP ${res.status})`
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Delete failed'
  } finally {
    const nextDel = new Set(deleting.value)
    nextDel.delete(id)
    deleting.value = nextDel
  }
}

async function bulkMarkRead() {
  const ids = Array.from(selected.value)
  if (ids.length === 0) return
  bulkWorking.value = true
  try {
    const res = await apiFetch('/api/feed/batch-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      const now = new Date().toISOString()
      for (const e of entries.value) {
        if (ids.includes(e.id)) e.read_at = e.read_at ?? now
      }
      selected.value = new Set()
    } else {
      errorMsg.value = `Bulk mark-read failed (HTTP ${res.status})`
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Bulk mark-read failed'
  } finally {
    bulkWorking.value = false
  }
}

async function bulkDelete() {
  const ids = Array.from(selected.value)
  if (ids.length === 0) return
  if (!window.confirm(`Delete ${ids.length} item${ids.length === 1 ? '' : 's'}?`)) return
  bulkWorking.value = true
  try {
    const res = await apiFetch('/api/feed/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      entries.value = entries.value.filter(e => !ids.includes(e.id))
      const nextExpanded = new Set(expanded.value)
      ids.forEach(id => nextExpanded.delete(id))
      expanded.value = nextExpanded
      selected.value = new Set()
    } else {
      errorMsg.value = `Bulk delete failed (HTTP ${res.status})`
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Bulk delete failed'
  } finally {
    bulkWorking.value = false
  }
}

// Debounce search: reload entries 300ms after the user stops typing
watch(searchQuery, (val) => {
  if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    loadEntries(val.trim() || undefined)
  }, 300)
})

onMounted(() => loadEntries())
</script>
