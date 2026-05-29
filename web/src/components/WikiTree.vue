<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import { ChevronRight, ChevronDown, Folder, FileText, FilePlus } from "lucide-vue-next";

  interface TreeNode {
    name: string;
    path: string;
    children: TreeNode[];
    isFolder: boolean;
  }

  const props = defineProps<{
    pages: string[];
    selectedPage: string | null;
    searchQuery: string;
  }>();

  const emit = defineEmits<{
    select: [path: string];
    addFile: [folderPath: string];
  }>();

  const expandedFolders = ref<Set<string>>(new Set());

  function buildTree(paths: string[]): TreeNode[] {
    const root: TreeNode[] = [];

    for (const path of paths) {
      const parts = path.split("/");
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        const fullPath = parts.slice(0, i + 1).join("/");
        const isFolder = i < parts.length - 1;

        let existing = current.find((n) => n.name === name && n.isFolder === isFolder);
        if (!existing) {
          existing = { name, path: fullPath, children: [], isFolder };
          current.push(existing);
        }
        current = existing.children;
      }
    }

    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(root);
    return root;
  }

  const tree = computed(() => {
    let filtered = props.pages;
    if (props.searchQuery) {
      const q = props.searchQuery.toLowerCase();
      filtered = props.pages.filter((p) => p.toLowerCase().includes(q));
    }
    return buildTree(filtered);
  });

  // Auto-expand to selected page
  watch(
    () => props.selectedPage,
    (path) => {
      if (!path) return;
      const parts = path.split("/");
      for (let i = 1; i < parts.length; i++) {
        expandedFolders.value.add(parts.slice(0, i).join("/"));
      }
    },
    { immediate: true }
  );

  function toggleFolder(path: string) {
    if (expandedFolders.value.has(path)) {
      expandedFolders.value.delete(path);
    } else {
      expandedFolders.value.add(path);
    }
  }

  function flattenVisible(nodes: TreeNode[], depth: number): { node: TreeNode; depth: number }[] {
    const result: { node: TreeNode; depth: number }[] = [];
    for (const node of nodes) {
      result.push({ node, depth });
      if (node.isFolder && expandedFolders.value.has(node.path)) {
        result.push(...flattenVisible(node.children, depth + 1));
      }
    }
    return result;
  }

  const visibleNodes = computed(() => flattenVisible(tree.value, 0));
</script>

<template>
  <div class="select-none">
    <div v-for="{ node, depth } in visibleNodes" :key="node.path" class="group relative">
      <button
        @click="node.isFolder ? toggleFolder(node.path) : emit('select', node.path)"
        class="w-full text-left flex items-center gap-1 py-1 text-xs rounded hover:bg-accent transition-colors"
        :class="{ 'bg-accent font-medium': !node.isFolder && selectedPage === node.path }"
        :style="{ paddingLeft: depth * 12 + 8 + 'px' }"
      >
        <template v-if="node.isFolder">
          <ChevronDown
            v-if="expandedFolders.has(node.path)"
            class="w-3 h-3 shrink-0 text-muted-foreground"
          />
          <ChevronRight v-else class="w-3 h-3 shrink-0 text-muted-foreground" />
          <Folder class="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        </template>
        <template v-else>
          <span class="w-3 shrink-0"></span>
          <FileText class="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        </template>
        <span class="truncate">{{ node.name }}</span>
      </button>
      <!-- Add file button on folder hover -->
      <button
        v-if="node.isFolder"
        @click.stop="emit('addFile', node.path)"
        class="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
        title="Add file here"
      >
        <FilePlus class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
