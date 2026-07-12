import { ref, type Ref } from 'vue'
import { perks } from '~/data/catalog'
import { toMarkdown, type Build } from '~/utils/planner'
import { normalizeBuild } from '~/utils/build-validation'

export function useBuildExport(build: Ref<Build>, requestImportedBuild: (build: Build) => void) {
  const importError = ref('')

  function exportJson() {
    download(`${safeName(build.value)}.json`, JSON.stringify(build.value, null, 2), 'application/json')
  }

  function exportMarkdown() {
    download(`${safeName(build.value)}.md`, toMarkdown(build.value, perks), 'text/markdown')
  }

  async function importJson(event: Event) {
    importError.value = ''
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const candidate = normalizeBuild(JSON.parse(await file.text()))
      if (!candidate) throw new Error('Unsupported build file')
      requestImportedBuild(candidate)
    } catch {
      importError.value = 'That file is not a compatible planner build.'
    }
    ;(event.target as HTMLInputElement).value = ''
  }

  return { importError, exportJson, exportMarkdown, importJson }
}

function safeName(build: Build) {
  return (build.name || 'fallout-4-build').toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
