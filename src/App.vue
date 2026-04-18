<template>
  <!-- Search Screen -->
  <div
    v-if="searchActive"
    data-testid="search-screen"
    class="fixed inset-0 bg-base z-50 flex flex-col"
    style="height: 100dvh;"
  >
    <header class="bg-chrome shadow-sm z-40 flex-shrink-0">
      <div class="h-16 flex items-center px-4 gap-2 max-w-4xl mx-auto w-full">
        <button
          @click="clearSearch"
          class="p-2 -ml-2 text-text-secondary active:bg-surface-active rounded-full transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="flex-1 relative">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search verses..."
            class="w-full py-2 pl-10 border border-border-default rounded-full focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none text-text-primary bg-surface placeholder-text-muted text-base"
            :class="searchQuery.trim() ? 'pr-9' : 'pr-3'"
            @keydown.escape="clearSearch"
          />
          <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button
            v-if="searchQuery.trim()"
            @click="searchQuery = ''"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary rounded-full transition-colors"
            title="Clear text"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </header>
    <div class="flex-1 overflow-y-auto px-4 pt-3 pb-8">
      <div class="max-w-4xl mx-auto">
      <div v-if="searchQuery.trim()" class="space-y-3">
        <div
          v-for="result in searchResults"
          :key="result.item.id"
          @click="handleVerseClick(result.item); clearSearch()"
          class="bg-surface rounded-2xl shadow-sm py-3 px-4 border border-border-default transition-all duration-200 cursor-pointer active:scale-98 relative"
        >
          <div class="flex flex-col gap-2">
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-lg font-semibold text-text-primary flex-1" v-html="highlightText(result.item.reference, result.matches, 'reference')"></h3>
              <div class="flex items-center gap-0.5 shrink-0">
                <button
                  @click.stop="startEditVerse(result.item)"
                  class="text-text-muted hover:text-text-primary p-1.5 rounded-full hover:bg-surface-hover transition-colors"
                  title="Edit verse"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  @click.stop="copyVerse(result.item)"
                  class="text-text-muted hover:text-text-primary p-1.5 rounded-full hover:bg-surface-hover transition-colors"
                  title="Share verse"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              </div>
            </div>
            <p class="text-text-secondary text-sm leading-relaxed" v-html="highlightText(result.item.content, result.matches, 'content')"></p>
          </div>
        </div>
        <div v-if="searchResults.length === 0" class="bg-surface rounded-2xl shadow-sm p-12 text-center">
          <p class="text-text-muted text-lg">No results found</p>
          <p class="text-text-muted text-sm mt-2">Try different search terms</p>
        </div>
      </div>
      <div v-else class="flex flex-col items-center justify-center pt-16 text-text-muted">
        <svg class="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p class="text-sm">Search across all your verses</p>
      </div>
      </div>
    </div>
  </div>

  <!-- Memorization Screen -->
  <div
    v-if="memorizingVerse"
    class="fixed inset-0 bg-base z-50 flex flex-col"
    style="height: 100dvh;"
  >
    <!-- Top App Bar -->
    <header class="bg-chrome shadow-sm z-40 flex-shrink-0">
      <div class="h-16 flex items-center px-4">
        <button
          @click="exitMemorization"
          class="p-2 -ml-2 mr-1 text-text-secondary active:bg-surface-active rounded-full transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-xl font-semibold text-text-primary flex-1 flex items-baseline min-w-0">
          <span class="truncate min-w-0">{{ splitReference(memorizingVerse.reference).book }}</span><span class="shrink-0 whitespace-nowrap" v-if="splitReference(memorizingVerse.reference).verseRef">&nbsp;{{ splitReference(memorizingVerse.reference).verseRef }}</span>
        </h1>
        <div class="flex items-center gap-1 ml-1 relative">
          <!-- Read Aloud / Stop Button -->
          <button
            @click="isSpeaking ? stopSpeaking() : speakVerse(memorizingVerse)"
            class="p-2 rounded-full transition-colors"
            :class="isSpeaking ? 'text-blue-600' : 'text-text-secondary active:bg-surface-active'"
            :title="isSpeaking ? 'Stop reading' : 'Read aloud'"
          >
            <svg v-if="isSpeaking" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.68-.57-1.93-1.42A9.69 9.69 0 012.25 12c0-.83.1-1.64.28-2.28.25-.85 1.05-1.42 1.93-1.42h2.24z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="relative flex-1 min-h-0 flex flex-col">
      <VersePracticeView
        :key="`${memorizingVerse?.id}-${memorizationMode}-${memorizationInstanceKey}`"
        ref="memorizationPracticeRef"
        :verse="memorizingVerse"
        :memorization-mode="memorizationMode"
        :review-words="reviewWords"
        context="memorization"
        v-model:typed-letter="typedLetter"
        :get-memorization-status="getMemorizationStatus"
        :can-switch-to-mode="canSwitchToMode"
        :is-partially-typed="isPartiallyTyped"
        :get-partial-word-text="getPartialWordText"
        :get-remaining-part-text="getRemainingPartText"
        input-id="letter-input-memorize"
        :show-tray="allWordsRevealed && !!memorizationMode"
        :show-practice-modes-hint="shouldShowPracticeModesHint"
        @input="checkLetter"
        @keydown="handleKeyPress"
        @switch-mode="switchToMemorizationMode"
        @dismiss-practice-modes-hint="dismissPracticeModesHint"
      />
      <Transition name="result-overlay">
        <div v-if="allWordsRevealed && memorizationMode" class="absolute inset-x-0 top-0 -bottom-6 bg-black/20 pointer-events-none" />
      </Transition>
    </div>

  <!-- Completion Tray for Memorization -->
  <Transition name="result-tray">
    <CompletionTray
      v-if="allWordsRevealed && memorizationMode"
      context="memorization"
      :meets-accuracy-requirement="meetsAccuracyRequirement"
      :accuracy="accuracy"
      :review-mistakes="reviewMistakes"
      :review-words-length="totalPracticeUnitCount"
      :memorization-mode="memorizationMode"
      @advance="advanceToNextMode"
      @exit="exitMemorization"
      @retry="retryMemorization"
    />
  </Transition>
  </div>

  <!-- Review Screen -->
  <div
    v-if="reviewingVerse"
    class="fixed inset-0 bg-base z-50 flex flex-col"
    style="height: 100dvh;"
  >
    <!-- Top App Bar -->
    <header class="bg-chrome shadow-sm z-40 flex-shrink-0">
      <div class="h-16 flex items-center px-4">
        <button
          @click="exitReview"
          class="p-2 -ml-2 mr-1 text-text-secondary active:bg-surface-active rounded-full transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-xl font-semibold text-text-primary flex-1 flex items-baseline min-w-0">
          <span class="truncate min-w-0">{{ splitReference(reviewingVerse.reference).book }}</span><span class="shrink-0 whitespace-nowrap" v-if="splitReference(reviewingVerse.reference).verseRef">&nbsp;{{ splitReference(reviewingVerse.reference).verseRef }}</span>
        </h1>
        <div class="flex items-center gap-1 ml-1">
          <!-- Read Aloud / Stop Button -->
          <button
            @click="isSpeaking ? stopSpeaking() : speakVerse(reviewingVerse)"
            class="p-2 rounded-full transition-colors"
            :class="isSpeaking ? 'text-blue-600' : 'text-text-secondary active:bg-surface-active'"
            :title="isSpeaking ? 'Stop reading' : 'Read aloud'"
          >
            <svg v-if="isSpeaking" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.68-.57-1.93-1.42A9.69 9.69 0 012.25 12c0-.83.1-1.64.28-2.28.25-.85 1.05-1.42 1.93-1.42h2.24z" />
            </svg>
          </button>
          <!-- Share Button -->
          <button
            @click="copyVerse(reviewingVerse)"
            class="p-2 text-text-secondary active:bg-surface-active rounded-full transition-colors"
            title="Share verse"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="relative flex-1 min-h-0 flex flex-col">
      <VersePracticeView
        :key="`${reviewingVerse.id}-${reviewInstanceKey}`"
        ref="reviewPracticeRef"
        :verse="reviewingVerse"
        :memorization-mode="memorizationMode"
        :review-words="reviewWords"
        context="review"
        v-model:typed-letter="typedLetter"
        :get-memorization-status="getMemorizationStatus"
        :can-switch-to-mode="canSwitchToModeForReview"
        :is-partially-typed="isPartiallyTyped"
        :get-partial-word-text="getPartialWordText"
        :get-remaining-part-text="getRemainingPartText"
        input-id="letter-input-review"
        :show-tray="allWordsRevealed && !!reviewingVerse"
        :show-practice-modes-hint="shouldShowPracticeModesHint"
        @input="checkLetter"
        @keydown="handleKeyPress"
        @switch-mode="switchReviewMode"
        @dismiss-practice-modes-hint="dismissPracticeModesHint"
      />
      <Transition name="result-overlay">
        <div v-if="allWordsRevealed && reviewingVerse" class="absolute inset-x-0 top-0 -bottom-6 bg-black/20 pointer-events-none" />
      </Transition>
    </div>

  <!-- Completion Tray for Review -->
  <Transition name="result-tray">
    <CompletionTray
      v-if="allWordsRevealed && reviewingVerse"
      context="review"
      :meets-accuracy-requirement="meetsAccuracyRequirement"
      :accuracy="accuracy"
      :review-mistakes="reviewMistakes"
      :review-words-length="totalPracticeUnitCount"
      :memorization-mode="memorizationMode"
      :next-review-label="reviewingVerseNextReviewLabel"
      @retry="retryReview"
      @next-verse="nextVerse"
    />
  </Transition>
  </div>

  <!-- Main Content -->
  <AppShell v-if="!memorizingVerse && !reviewingVerse" class="min-h-screen">
    <!-- Top App Bar (verses/collections screen only) -->
    <header v-if="currentView === 'collections'" :class="['glass-chrome fixed top-0 left-0 right-0 z-40', isScrolled ? '' : 'glass-chrome--transparent']">
      <div class="h-16 flex items-center px-2 max-w-4xl mx-auto w-full">
        <!-- Hamburger menu button (top-level only) -->
        <button
          v-if="!currentCollectionId"
          @click="toggleDrawer"
          data-testid="hamburger-button"
          class="p-2 text-text-secondary active:bg-surface-active rounded-full transition-colors relative flex-shrink-0"
          title="Menu"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span
            v-if="shouldShowBackupReminder"
            class="absolute top-1 right-1 w-2 h-2 bg-accent-warm rounded-full"
          ></span>
        </button>
        <!-- Back button (inside collection) -->
        <button
          v-if="currentCollectionId"
          @click="viewAllVerses"
          class="p-2 text-text-secondary active:bg-surface-active rounded-full transition-colors flex-shrink-0"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Search bar (top-level verses screen) -->
        <div
          v-if="!currentCollectionId"
          class="flex-1 mx-2 cursor-pointer"
          data-testid="search-bar"
          @click="openSearch"
        >
          <div class="flex items-center h-10 bg-surface rounded-full px-4 gap-2 border border-border-default">
            <svg class="w-4 h-4 text-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span class="text-text-muted text-sm flex-1">Search verses...</span>
          </div>
        </div>

        <!-- Collection title -->
        <h1 v-if="currentCollectionId" class="text-xl font-serif font-normal tracking-tight text-text-primary flex-1 ml-2 truncate">
          {{ getCollectionName(currentCollectionId) }}
        </h1>

        <!-- Right side actions -->
        <div class="flex items-center gap-1 flex-shrink-0">
          <!-- Install app button (top-level verses screen only) -->
          <button
            v-if="!isPWAInstalled() && !currentCollectionId"
            data-testid="install-app-header"
            @click="triggerInstall"
            class="btn-primary btn--sm"
          >
            Install app
          </button>
        </div>
      </div>
    </header>

    <!-- Navigation Drawer -->
      <div
        v-if="drawerVisible"
        class="fixed inset-0 z-[60]"
        :class="drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 pointer-events-auto transition-opacity duration-300"
          :class="drawerOpen ? 'opacity-100' : 'opacity-0'"
          @click="closeDrawer"
        />
        <!-- Drawer panel -->
        <div
          class="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-chrome shadow-2xl flex flex-col pointer-events-auto transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform"
          :class="drawerOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-95'"
          style="border-radius: 0 16px 16px 0;"
        >
        <!-- App header -->
        <div class="px-6 pt-10 pb-5" style="padding-top: max(2.5rem, calc(env(safe-area-inset-top) + 1rem));">
          <div class="flex items-center gap-3">
            <BrandMark size="sm" />
            <span class="font-serif text-2xl tracking-tight text-text-primary">rum1n8</span>
          </div>
          <p class="mt-2 font-serif italic text-sm text-text-muted">Bible verse memorization</p>
        </div>
        <div class="border-t border-border-default mx-4 mb-2" />
        <!-- Settings items -->
        <nav class="flex-1 px-3 py-2 overflow-y-auto">
          <button
            data-testid="settings-sync-now"
            @click="manualSyncFromDrawer"
            :disabled="syncing"
            class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left text-base text-text-secondary hover:bg-surface-hover active:bg-surface-active transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg
              v-if="syncing"
              class="w-5 h-5 shrink-0 animate-spin-reverse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style="transform-origin: center;"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <svg
              v-else
              class="w-5 h-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ syncing ? 'Syncing…' : 'Sync now' }}
          </button>
          <button
            data-testid="settings-practice"
            @click="openPracticeSettings"
            class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left text-base text-text-secondary hover:bg-surface-hover active:bg-surface-active transition-colors"
          >
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.5 4.75c.83-1.67 2.17-1.67 3 0l.2.4a1.7 1.7 0 002.12.82l.43-.14c1.8-.59 2.75.36 2.16 2.16l-.14.43a1.7 1.7 0 00.82 2.12l.4.2c1.67.83 1.67 2.17 0 3l-.4.2a1.7 1.7 0 00-.82 2.12l.14.43c.59 1.8-.36 2.75-2.16 2.16l-.43-.14a1.7 1.7 0 00-2.12.82l-.2.4c-.83 1.67-2.17 1.67-3 0l-.2-.4a1.7 1.7 0 00-2.12-.82l-.43.14c-1.8.59-2.75-.36-2.16-2.16l.14-.43a1.7 1.7 0 00-.82-2.12l-.4-.2c-1.67-.83-1.67-2.17 0-3l.4-.2a1.7 1.7 0 00.82-2.12l-.14-.43c-.59-1.8.36-2.75 2.16-2.16l.43.14a1.7 1.7 0 002.12-.82z" />
              <circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
            </svg>
            Settings
          </button>
          <button
            data-testid="settings-sync"
            @click="openSyncSettings"
            class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left text-base text-text-secondary hover:bg-surface-hover active:bg-surface-active transition-colors"
          >
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            Configure Sync
          </button>
          <button
            data-testid="settings-backup"
            @click="openBackupImport"
            class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left text-base text-text-secondary hover:bg-surface-hover active:bg-surface-active transition-colors relative"
          >
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Restore & Export
            <span
              v-if="shouldShowBackupReminder"
              class="ml-auto w-2 h-2 bg-accent-warm rounded-full flex-shrink-0"
            ></span>
          </button>
          <button
            data-testid="settings-about"
            @click="openAbout"
            class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left text-base text-text-secondary hover:bg-surface-hover active:bg-surface-active transition-colors"
          >
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            About
          </button>
        </nav>
        <div class="px-6 pb-5 pt-2">
          <p class="text-xs text-text-muted">v{{ appVersion }}</p>
        </div>
        </div>
      </div>

    <!-- Sync Error Toast -->
    <div
      v-if="syncError"
      class="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-status-due-bg border border-status-due-border rounded-lg shadow-lg p-4 max-w-md mx-4"
    >
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-status-error-text flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-status-error-text">Sync Failed</p>
          <p class="text-sm text-status-error-text mt-1">{{ syncError }}</p>
        </div>
        <button
          @click="syncError = null"
          class="text-status-error-text hover:text-status-error-text flex-shrink-0"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Content Area: fixed header + bottom nav padding only on collections/verses screen -->
    <div :class="['px-4', currentView === 'collections' ? 'pt-16 pb-24' : '']">
      <div class="max-w-4xl mx-auto">

      <!-- Review List View -->
      <div v-if="currentView === 'review-list' && !currentCollectionId" class="">
        <div class="space-y-2 py-4 overflow-y-auto stagger-fade" style="max-height: calc(100vh - 4rem);">
          <div
            v-if="shouldShowReviewOnboardingTip"
            data-testid="review-onboarding-tip"
            class="practice-hint"
          >
            <div class="flex items-start gap-3">
              <div class="practice-hint__icon">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8m-4-4h8" />
                </svg>
              </div>
              <div class="flex-1">
                <p class="practice-hint__title">Review your verses here daily.</p>
                <p class="practice-hint__body">Due verses stay at the top.</p>
              </div>
              <button
                type="button"
                class="btn-ghost text-sm"
                @click="dismissReviewOnboardingTip"
              >
                Got it
              </button>
            </div>
          </div>

          <PrimaryButton
            v-if="reviewSortedVerses.length > 0"
            data-testid="start-review-cta"
            class="w-full"
            @click="handleVerseClick(reviewSortedVerses[0])"
          >
            Start review<span v-if="dueVersesCount > 0"> · {{ dueVersesCount }} due</span>
          </PrimaryButton>

          <div
            v-for="verse in reviewSortedVerses"
            :key="verse.id"
            @click="handleVerseClick(verse)"
            class="verse-card"
            :class="{ 'verse-card--due': isDueForReview(verse) }"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
                <HeadwordReference :reference="verse.reference" size="sm" />
                <span v-if="verse.bibleVersion" class="verse-card__version">/{{ verse.bibleVersion.toLowerCase() }}/</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <POSBadge
                  v-if="isDueForReview(verse)"
                  status="mastered"
                  :due="true"
                />
                <span v-else class="verse-card__meta">{{ getTimeUntilReview(verse) }}</span>
              </div>
            </div>
          </div>

          <!-- Empty state when no verses to review -->
          <div v-if="reviewSortedVerses.length === 0" class="bg-chrome rounded-2xl border border-border-default p-12 text-center mt-8">
            <svg class="w-16 h-16 mx-auto mb-4 text-accent-warm opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="font-serif text-lg text-text-primary">No verses to review</p>
            <p class="text-text-muted text-sm mt-2">Master some verses to see them here</p>
          </div>
        </div>
      </div>

      <!-- Collections View -->
      <div v-if="currentView === 'collections' && !currentCollectionId && collections.length > 0">

        <div class="overflow-y-auto -mt-16 -mb-24 -mx-4 px-4 pt-20 pb-28" style="max-height: 100dvh;">
          <CollectionsAlmanac
            v-if="totalVerseCount > 0"
            :current-streak="currentStreak"
            :due-verses-count="dueVersesCount"
            :mastered-count="masteredCount"
            :show-start-review="reviewSortedVerses.length > 0"
            section-title="Your Collections"
            @start-review="handleVerseClick(reviewSortedVerses[0])"
          />

          <!-- Collection Cards -->
          <div v-if="collections.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-fade">
          <!-- Master List Collection -->
          <div
            @click="viewCollection('master-list')"
            class="collection-tile cursor-pointer"
            :class="{ 'collection-tile--due': dueVersesCount > 0 }"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <svg class="w-5 h-5 shrink-0 text-accent-strong" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h3 class="collection-tile__name">{{ getCollectionName('master-list') }}</h3>
              </div>
              <POSBadge v-if="dueVersesCount > 0" status="mastered" :due="true" />
            </div>
            <div class="collection-tile__meta">
              {{ totalVerseCount }} verse{{ totalVerseCount !== 1 ? 's' : '' }}
            </div>
          </div>

          <!-- No Collection -->
          <div
            v-if="hasNoCollectionVerses"
            @click="viewCollection('no-collection')"
            class="collection-tile cursor-pointer"
            :class="{ 'collection-tile--due': getCollectionDueCount('no-collection') > 0 }"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <svg class="w-5 h-5 shrink-0 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <h3 class="collection-tile__name">{{ getCollectionName('no-collection') }}</h3>
              </div>
              <POSBadge v-if="getCollectionDueCount('no-collection') > 0" status="mastered" :due="true" />
            </div>
            <div class="collection-tile__meta">
              {{ getCollectionVerseCount('no-collection') }} verse{{ getCollectionVerseCount('no-collection') !== 1 ? 's' : '' }}
            </div>
          </div>

          <!-- To Learn -->
          <div
            v-if="hasToLearnVerses"
            @click="viewCollection('to-learn')"
            class="collection-tile cursor-pointer"
            :class="{ 'collection-tile--due': getCollectionDueCount('to-learn') > 0 }"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <svg class="w-5 h-5 shrink-0 text-accent-warm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
                <h3 class="collection-tile__name">{{ getCollectionName('to-learn') }}</h3>
              </div>
              <POSBadge v-if="getCollectionDueCount('to-learn') > 0" status="mastered" :due="true" />
            </div>
            <div class="collection-tile__meta">
              {{ getCollectionVerseCount('to-learn') }} verse{{ getCollectionVerseCount('to-learn') !== 1 ? 's' : '' }}
            </div>
          </div>

          <!-- User Collections -->
          <div
            v-for="collection in collections"
            :key="collection.id"
            @click="viewCollection(collection.id)"
            class="collection-tile cursor-pointer"
            :class="{ 'collection-tile--due': getCollectionDueCount(collection.id) > 0 }"
          >
            <div class="flex items-start justify-between gap-2">
              <h3 class="collection-tile__name flex-1">{{ collection.name }}</h3>
              <div class="flex items-center gap-1 shrink-0">
                <POSBadge v-if="getCollectionDueCount(collection.id) > 0" status="mastered" :due="true" />
                <button
                  @click.stop="startEditCollection(collection)"
                  class="text-text-muted hover:text-accent-warm hover:bg-surface-hover p-1.5 rounded-full transition-colors"
                  title="Edit collection"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            </div>
            <p v-if="collection.description" class="collection-tile__description line-clamp-2">{{ collection.description }}</p>
            <div class="collection-tile__meta">
              {{ getCollectionVerseCount(collection.id) }} verse{{ getCollectionVerseCount(collection.id) !== 1 ? 's' : '' }}
            </div>
          </div>

          </div>
        </div>
      </div>

      <!-- Stats View -->
      <div v-if="currentView === 'stats' && !currentCollectionId" class="">
        <div class="space-y-6 py-4 overflow-y-auto pb-24" style="max-height: calc(100vh - 4rem);">

          <!-- Streak Card -->
          <div class="stats-card">
            <h3 class="stats-card__label">Current Streak</h3>
            <div class="flex items-baseline gap-2">
              <span class="stats-card__numeral">{{ currentStreak }}</span>
              <span class="text-lg text-text-muted font-serif italic">day{{ currentStreak !== 1 ? 's' : '' }}</span>
            </div>
          </div>

          <!-- Daily Activity Card -->
          <div class="stats-card">
            <h3 class="stats-card__label">Daily Activity</h3>
            <div v-if="dailyActivityData.labels.length > 0">
              <!-- Legend -->
              <div class="flex items-center gap-4 mb-2">
                <div class="flex items-center gap-1.5">
                  <span class="w-3 h-3 rounded-sm" :style="{ backgroundColor: chartColors.accent + 'AA' }"></span>
                  <span class="text-xs text-text-secondary">Reviews</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-3 h-3 rounded-sm" :style="{ backgroundColor: chartColors.success + 'AA' }"></span>
                  <span class="text-xs text-text-secondary">Mastered</span>
                </div>
              </div>
              <!-- Chart with fixed y-axis -->
              <div class="flex w-full">
                <!-- Fixed y-axis labels -->
                <div class="shrink-0 flex flex-col justify-between pr-1 text-right" style="height: 170px; width: 24px; padding-bottom: 0px;">
                  <span v-for="label in yAxisLabels" :key="label" class="text-text-muted leading-none" style="font-size: 10px;">{{ label }}</span>
                </div>
                <!-- Scrollable chart -->
                <div ref="dailyActivityScrollRef" class="overflow-x-auto flex-1 min-w-0" style="height: 200px;">
                  <div class="min-w-full" :style="{ width: Math.max(dailyActivityData.labels.length * 40, 0) + 'px', height: '200px' }">
                    <Bar :key="'bar-' + isDark" :data="dailyBarChartData" :options="barChartOptions" />
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="py-8 text-center">
              <p class="text-text-muted text-sm">No review activity yet</p>
            </div>
          </div>

          <!-- Mastered Over Time Card -->
          <div class="stats-card">
            <h3 class="stats-card__label">Verses Mastered</h3>
            <div v-if="masteredOverTimeData.labels.length > 0" class="h-48">
              <Line :key="'line-' + isDark" :data="masteredChartData" :options="lineChartOptions" />
            </div>
            <div v-else class="py-8 text-center">
              <p class="text-text-muted text-sm">No mastered verses yet</p>
            </div>
          </div>

        </div>
      </div>

      <!-- Collection View -->
      <div
        v-if="currentCollectionId || (currentView === 'collections' && !currentCollectionId && collections.length === 0)"
        :class="currentView === 'collections' && !currentCollectionId && collections.length === 0
          ? `flex min-h-0 flex-col overflow-hidden${totalVerseCount > 0 ? ' pt-4' : ''}`
          : ''"
        :style="currentView === 'collections' && !currentCollectionId && collections.length === 0 ? { maxHeight: 'calc(100vh - 8rem)' } : null"
      >
        <CollectionsAlmanac
          v-if="currentView === 'collections' && !currentCollectionId && collections.length === 0 && totalVerseCount > 0"
          :current-streak="currentStreak"
          :due-verses-count="dueVersesCount"
          :mastered-count="masteredCount"
          :show-start-review="reviewSortedVerses.length > 0"
          section-title="Your Verses"
          @start-review="handleVerseClick(reviewSortedVerses[0])"
        />

        <!-- Verse List -->
        <div
          :class="[
            'space-y-3 py-4 stagger-fade',
            currentView === 'collections' && !currentCollectionId && collections.length === 0
              ? `min-h-0 flex-1 overflow-y-auto pb-36${totalVerseCount > 0 ? ' pt-0' : ''}`
              : 'overflow-y-auto max-h-[calc(100vh-4rem)] pb-36'
          ]"
        >
        <div
          v-for="verse in sortedVerses"
          :key="verse.id"
          :class="[
            'relative',
            shouldShowVerseOnboardingCallout && verse.id === guidedOnboardingVerseId
              ? 'pb-24 sm:pb-20'
              : ''
          ]"
        >
          <div
            v-if="shouldShowVerseOnboardingCallout && verse.id === guidedOnboardingVerseId"
            class="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex px-4"
          >
            <div class="pointer-events-auto relative w-[calc(100%-1rem)] max-w-sm rounded-2xl border border-border-default bg-elevated px-4 py-3 shadow-xl">
              <div class="absolute left-8 bottom-full h-4 w-4 translate-y-2 rotate-45 border-l border-t border-border-default bg-elevated" />
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-warm/15 text-accent-warm">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-text-primary">
                    {{ guidedOnboardingStep === 'practice' ? 'Tap your verse to keep memorizing it.' : 'Tap your verse to start memorizing it.' }}
                  </p>
                </div>
                <button
                  type="button"
                  class="rounded-xl px-2 py-1 text-sm font-medium text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
                  @click.stop="skipGuidedOnboarding"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>

          <div
            :ref="(el) => setVerseCardRef(verse.id, el)"
            @click="handleVerseClick(verse)"
            class="verse-card"
            :class="[
              {
                'verse-card--due': verse.memorizationStatus === 'mastered' && isDueForReview(verse),
                'verse-card--expanded': isVerseExpanded(verse),
                'verse-card--learning': verse.memorizationStatus !== 'mastered',
                'verse-card--onboarding': shouldShowVerseOnboardingCallout && verse.id === guidedOnboardingVerseId,
              },
              shouldShowVerseOnboardingCallout && verse.id === guidedOnboardingVerseId
                ? 'z-40'
                : ''
            ]"
          >
          <div class="flex gap-2 items-start">
            <button
              type="button"
              @click="toggleVerseExpanded(verse, $event)"
              class="shrink-0 mt-0.5 p-1 -ml-1 rounded-full text-text-muted hover:bg-surface-hover hover:text-accent-warm transition-all duration-200"
              :class="{ 'rotate-90': isVerseExpanded(verse) }"
              :aria-label="isVerseExpanded(verse) ? 'Collapse verse' : 'Expand verse'"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 justify-between">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
                  <HeadwordReference :reference="verse.reference" size="sm" />
                  <span v-if="verse.bibleVersion" class="verse-card__version">/{{ verse.bibleVersion.toLowerCase() }}/</span>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <POSBadge
                    v-if="verse.memorizationStatus !== 'mastered' || isDueForReview(verse)"
                    :status="verse.memorizationStatus"
                    :due="verse.memorizationStatus === 'mastered' && isDueForReview(verse)"
                  />
                  <span v-else class="verse-card__meta">{{ getTimeUntilReview(verse) }}</span>
                  <button
                    @click.stop="startEditVerse(verse)"
                    class="text-text-muted hover:text-accent-warm hover:bg-surface-hover p-1.5 rounded-full shrink-0 transition-colors"
                    title="Edit verse"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>
              <Transition
                name="verse-expand"
                @before-enter="beforeVerseExpand"
                @enter="enterVerseExpand"
                @after-enter="afterVerseExpand"
                @before-leave="beforeVerseCollapse"
                @leave="leaveVerseCollapse"
                @after-leave="afterVerseCollapse"
              >
                <div
                  v-if="isVerseExpanded(verse)"
                  class="verse-card__body"
                >
                  {{ verse.content }}
                </div>
              </Transition>
            </div>
          </div>
          </div>
        </div>

          <div
            v-if="shouldShowHeroOnboarding"
            data-testid="getting-started-card"
            class="hero-onboarding"
          >
            <p class="hero-onboarding__eyebrow">rum1n8</p>
            <h2 class="hero-onboarding__title">Start with one verse.</h2>
            <p class="hero-onboarding__subtitle">Turn it over in your mind — day by day, word by word.</p>
            <div class="mt-7 flex flex-wrap items-center gap-4">
              <PrimaryButton @click="openHeroVerseModal">
                Add your first verse
                <span class="sr-only">Add a verse</span>
              </PrimaryButton>
              <button
                type="button"
                class="btn-ghost text-sm"
                @click="skipGuidedOnboarding"
              >
                Skip
              </button>
            </div>
          </div>

          <div v-else-if="sortedVerses.length === 0" class="empty-state mt-8">
            <svg class="w-14 h-14 mx-auto mb-4 text-accent-warm opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p class="empty-state__title">No verses yet.</p>
            <p class="empty-state__body">Tap + to add a verse</p>
          </div>
        </div>
      </div>
      </div>
    </div>

    <div
      v-if="shouldShowGuidedOnboardingScrim"
      class="pointer-events-none fixed inset-0 z-30 bg-black/20"
    />

    <!-- Bottom Navigation -->
    <nav v-if="!memorizingVerse && !reviewingVerse && !currentCollectionId" class="glass-chrome glass-chrome--nav fixed bottom-0 left-0 right-0 z-40" style="padding-bottom: env(safe-area-inset-bottom);">
      <div class="flex items-center justify-around h-16 max-w-4xl mx-auto">
        <!-- Verses Tab (far left) -->
        <button
          data-testid="nav-collections"
          @click="navigateToCollections"
          :class="[
            'tab-btn',
            currentView === 'collections' ? 'tab-btn--active' : 'tab-btn--inactive'
          ]"
        >
          <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span class="tab-btn__label">Verses</span>
        </button>

        <!-- Review Tab -->
        <div class="relative flex flex-1 items-center justify-center h-full">
          <button
            data-testid="nav-review"
            @click="navigateToReviewList"
            :class="[
              'tab-btn',
              currentView === 'review-list' ? 'tab-btn--active' : 'tab-btn--inactive',
              shouldShowReviewTabCallout
                ? 'z-40 ring-2 ring-accent-warm shadow-lg'
                : ''
            ]"
          >
            <div class="relative">
              <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="6" width="20" height="12" rx="2" stroke-width="2" />
                <path stroke-linecap="round" stroke-width="2" d="M6 15h12M6 10h1M9 10h1M12 10h1M15 10h1M18 10h1" />
              </svg>
              <span
                v-if="dueVersesCount > 0"
                class="absolute -top-1 -right-2 min-w-[1.1rem] h-[1.1rem] flex items-center justify-center text-[0.6rem] font-bold leading-none text-white bg-accent-warm rounded-full px-0.5"
              >{{ dueVersesCount > 99 ? '99+' : dueVersesCount }}</span>
            </div>
            <span class="tab-btn__label">Review</span>
          </button>

          <div
            v-if="shouldShowReviewTabCallout"
            class="pointer-events-auto absolute bottom-full left-1/2 z-50 mb-3 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2"
          >
            <div class="relative rounded-2xl border border-border-default bg-elevated px-4 py-3 shadow-xl">
              <div class="absolute left-1/2 top-full h-4 w-4 -translate-x-1/2 -translate-y-2 rotate-45 border-b border-r border-border-default bg-elevated" />
              <p class="text-sm font-semibold text-text-primary">Nice. You've finished your first verse.</p>
              <p class="mt-1 text-sm leading-relaxed text-text-secondary">Tap Review next.</p>
              <div class="mt-3 flex justify-end">
                <button
                  type="button"
                  class="rounded-xl px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
                  @click="skipGuidedOnboarding"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats Tab (far right) -->
        <button
          data-testid="nav-stats"
          @click="navigateToStats"
          :class="[
            'tab-btn',
            currentView === 'stats' ? 'tab-btn--active' : 'tab-btn--inactive'
          ]"
        >
          <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span class="tab-btn__label">Stats</span>
        </button>
      </div>
    </nav>

    <!-- Floating Action Button with Menu -->
    <div 
      v-if="!memorizingVerse && !reviewingVerse && currentView !== 'review-list' && currentView !== 'stats'"
      :class="[
        'fixed right-6 z-30',
        !currentCollectionId
          ? 'bottom-20'
          : 'bottom-6'
      ]"
    >
      <!-- FAB Menu (shown on collections screen and inside collections) -->
      <transition-group
        name="fab-menu"
        tag="div"
        class="absolute bottom-20 right-0 mb-2 flex flex-col gap-2"
      >
        <!-- New Verse Option -->
        <button
          v-if="fabMenuOpen"
          key="verse"
          data-testid="fab-new-verse"
          @click="openNewVerse"
          class="fab-menu__item bg-elevated text-text-primary rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3 px-4 py-3 min-w-[160px] active:bg-surface-active"
          :style="{ '--fab-index': !currentCollectionId && currentView === 'collections' ? 2 : 1, boxShadow: '0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' }"
        >
          <div class="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span class="text-sm font-medium">New Verse</span>
        </button>

        <!-- New Collection Option (only on collections screen) -->
        <button
          v-if="fabMenuOpen && !currentCollectionId && currentView === 'collections'"
          key="collection"
          data-testid="fab-new-collection"
          @click="openNewCollection"
          class="fab-menu__item bg-elevated text-text-primary rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3 px-4 py-3 min-w-[160px] active:bg-surface-active"
          style="--fab-index: 1; box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);"
        >
          <div class="w-10 h-10 bg-accent-warm rounded-full flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span class="text-sm font-medium">New Collection</span>
        </button>

        <!-- Import CSV Option (collections screen or inside collection) -->
        <button
          v-if="fabMenuOpen && (currentCollectionId || (!currentCollectionId && currentView === 'collections'))"
          key="import"
          data-testid="fab-import-csv"
          @click="openImportCSV"
          class="fab-menu__item bg-elevated text-text-primary rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3 px-4 py-3 min-w-[160px] active:bg-surface-active"
          style="--fab-index: 0; box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);"
        >
          <div class="w-10 h-10 bg-accent-strong rounded-full flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <span class="text-sm font-medium">Import CSV</span>
        </button>
      </transition-group>

      <!-- Main FAB Button -->
      <button
        data-testid="fab-trigger"
        @click="handleFabClick"
        class="w-14 h-14 bg-gradient-primary active:scale-95 text-white rounded-full shadow-lift transition-all duration-200 flex items-center justify-center"
        :class="{ 'rotate-45': fabMenuOpen }"
        :title="currentCollectionId ? 'Add new verse' : 'Add new item'"
      >
        <svg class="w-7 h-7 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Backdrop to close menu when clicking outside -->
    <div
      v-if="fabMenuOpen && !memorizingVerse && !reviewingVerse && currentView !== 'review-list' && currentView !== 'stats'"
      @click="fabMenuOpen = false"
      class="fixed inset-0 z-20"
    ></div>
  </AppShell>

  <!-- iOS Install Modal -->
  <IOSInstallModal
    v-if="showIOSModal"
    @close="closeIOSModal"
  />

  <!-- Toast Notification - rendered at root level to appear above all screens -->
  <transition name="toast">
    <div
      v-if="toastState.show"
      class="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-lg max-w-sm"
      :class="toastState.isError ? 'bg-status-error-bg text-status-error-text border border-status-error-border' : 'bg-status-success-bg text-status-success-text border border-status-success-border'"
    >
      <div class="flex items-center gap-2">
        <svg v-if="!toastState.isError" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span class="text-sm font-medium">{{ toastState.message }}</span>
      </div>
    </div>
  </transition>

      <!-- Add Verse Form Modal -->
      <ModalSheet :show="showForm" title="Add New Verse" data-testid="modal-add-verse" @close="closeForm">
        <form id="add-verse-form" @submit.prevent="addVerse" class="space-y-4">
          <div>
            <label for="reference" class="block text-sm font-medium text-text-secondary mb-2">
              Verse Reference
            </label>
            <input
              id="reference"
              v-model="newVerse.reference"
              type="text"
              placeholder="e.g., Joshua 1:8-9"
              required
              class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary"
            />
          </div>

          <div>
            <label for="bible-version" class="block text-sm font-medium text-text-secondary mb-2">
              Bible Version
            </label>
            <input
              id="bible-version"
              v-model="newVerse.bibleVersion"
              type="text"
              placeholder="e.g., BSB, NIV, ESV"
              maxlength="10"
              class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary uppercase tracking-wider"
              style="text-transform: uppercase;"
            />
          </div>

          <div>
            <button
              type="button"
              @click="importVerseContent"
              :disabled="!newVerse.reference || !newVerse.bibleVersion || importingVerse"
              class="btn-secondary btn--sm"
            >
              <svg v-if="importingVerse" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ importingVerse ? 'Importing...' : 'Import Content' }}</span>
            </button>

            <div v-if="importError" class="mt-2 p-3 bg-status-amber-bg border border-status-amber-border rounded-lg">
              <p class="text-sm text-status-amber-text">{{ importError }}</p>
              <a
                v-if="importErrorShowLink"
                href="https://fetch.bible/content/need/"
                target="_blank"
                class="text-sm text-status-purple-text hover:text-status-purple-text underline mt-1 inline-block"
              >
                Learn more about available translations
              </a>
            </div>
          </div>

          <div>
            <label for="content" class="block text-sm font-medium text-text-secondary mb-2">
              Verse Content
            </label>
            <textarea
              id="content"
              v-model="newVerse.content"
              rows="6"
              placeholder="Enter the verse text here..."
              required
              class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary resize-none"
            ></textarea>
          </div>

          <CollectionPicker
            v-if="!currentCollectionId || currentCollectionId === 'master-list'"
            :collections="collections"
            v-model="newVerse.collectionIds"
          />
        </form>

        <template #footer>
          <div class="flex justify-end space-x-3">
            <button
              type="button"
              @click="closeForm"
              class="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-verse-form"
              class="btn-primary"
            >
              Save Verse
            </button>
          </div>
        </template>
      </ModalSheet>

      <!-- Edit Verse Form Modal -->
      <ModalSheet :show="showEditVerseForm" title="Edit Verse" data-testid="modal-edit-verse" @close="closeEditVerseForm">
        <form id="edit-verse-form" @submit.prevent="saveEditedVerse" class="space-y-4" v-if="editingVerse">
          <div>
            <label for="edit-reference" class="block text-sm font-medium text-text-secondary mb-2">
              Verse Reference
            </label>
            <input
              id="edit-reference"
              v-model="editingVerse.reference"
              type="text"
              placeholder="e.g., Joshua 1:8-9"
              required
              class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary"
            />
          </div>

          <div>
            <label for="edit-bible-version" class="block text-sm font-medium text-text-secondary mb-2">
              Bible Version
            </label>
            <input
              id="edit-bible-version"
              v-model="editingVerse.bibleVersion"
              type="text"
              placeholder="e.g., BSB, NIV, ESV"
              maxlength="10"
              class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary uppercase tracking-wider"
              style="text-transform: uppercase;"
            />
          </div>

          <div>
            <label for="edit-content" class="block text-sm font-medium text-text-secondary mb-2">
              Verse Content
            </label>
            <textarea
              id="edit-content"
              v-model="editingVerse.content"
              rows="6"
              placeholder="Enter the verse text here..."
              required
              class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary resize-none"
            ></textarea>
          </div>

          <CollectionPicker
            :collections="collections"
            v-model="editingVerse.collectionIds"
          />
        </form>

        <template #footer>
          <div class="flex justify-between items-center">
            <button
              type="button"
              @click="handleDeleteVerseFromModal"
              class="btn-danger"
            >
              Delete
            </button>
            <div class="flex space-x-3">
              <button
                type="button"
                @click="closeEditVerseForm"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-verse-form"
                class="btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </template>
      </ModalSheet>

      <!-- Add Collection Form Modal -->
      <ModalSheet :show="showCollectionForm" title="Create New Collection" data-testid="modal-add-collection" max-width="sm:max-w-lg" @close="closeCollectionForm">
        <form id="add-collection-form" @submit.prevent="addCollection" class="space-y-4">
          <div>
            <label for="collection-name" class="block text-sm font-medium text-text-secondary mb-2">
              Collection Name
            </label>
            <input
              id="collection-name"
              v-model="newCollection.name"
              type="text"
              placeholder="e.g., Favorite Verses, Daily Devotion"
              required
              class="w-full px-4 py-2 border border-border-input rounded-lg focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary"
            />
          </div>

          <div>
            <label for="collection-description" class="block text-sm font-medium text-text-secondary mb-2">
              Description (optional)
            </label>
            <textarea
              id="collection-description"
              v-model="newCollection.description"
              rows="3"
              placeholder="Describe this collection..."
              class="w-full px-4 py-2 border border-border-input rounded-lg focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary resize-none"
            ></textarea>
          </div>
        </form>

        <template #footer>
          <div class="flex justify-end space-x-3">
            <button
              type="button"
              @click="closeCollectionForm"
              class="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-collection-form"
              class="btn-primary"
            >
              Create Collection
            </button>
          </div>
        </template>
      </ModalSheet>

      <!-- Edit Collection Form Modal -->
      <ModalSheet :show="showEditCollectionForm" title="Edit Collection" data-testid="modal-edit-collection" max-width="sm:max-w-lg" @close="closeEditCollectionForm">
        <form id="edit-collection-form" @submit.prevent="saveEditedCollection" class="space-y-4" v-if="editingCollection">
          <div>
            <label for="edit-collection-name" class="block text-sm font-medium text-text-secondary mb-2">
              Collection Name
            </label>
            <input
              id="edit-collection-name"
              v-model="editingCollection.name"
              type="text"
              placeholder="e.g., Favorite Verses, Daily Devotion"
              required
              class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary"
            />
          </div>

          <div>
            <label for="edit-collection-description" class="block text-sm font-medium text-text-secondary mb-2">
              Description (optional)
            </label>
            <textarea
              id="edit-collection-description"
              v-model="editingCollection.description"
              rows="3"
              placeholder="Describe this collection..."
              class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary resize-none"
            ></textarea>
          </div>
        </form>

        <template #footer>
          <div class="flex justify-between items-center">
            <button
              type="button"
              @click="handleDeleteCollectionFromModal"
              class="btn-danger"
            >
              Delete
            </button>
            <div class="flex space-x-3">
              <button
                type="button"
                @click="closeEditCollectionForm"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-collection-form"
                class="btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </template>
      </ModalSheet>

      <!-- CSV Import Modal -->
      <ModalSheet :show="showImportCSV" title="Import Verses from CSV" data-testid="modal-import-csv" @close="closeImportCSV">
        <div class="space-y-4">
          <p class="text-sm text-text-secondary">
            Upload a CSV file with columns: <strong>Reference</strong> (required), <strong>Content</strong> (required), and optional fields: <strong>Version</strong>, <strong>DaysUntilNextReview</strong>, <strong>Interval</strong>.
          </p>
          <div class="bg-status-info-bg border border-status-info-border rounded-lg p-4">
            <p class="text-xs text-status-info-text mb-2"><strong>CSV Format:</strong></p>
            <pre class="text-xs text-status-info-text bg-status-info-bg p-2 rounded overflow-x-auto">Reference,Content,Version,DaysUntilNextReview,Interval
John 3:16,"For God so loved the world...",NIV,45,60
Romans 8:28,"And we know that in all things...",ESV,30,60</pre>
            <p class="text-xs text-status-info-text mt-2">
              <strong>Optional columns:</strong> Version, DaysUntilNextReview (days until next review), Interval (review interval in days).
              When Interval and DaysUntilNextReview are provided, verses will be imported with memorization progress.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-text-secondary mb-3">
              Import CSV
            </label>

            <!-- File Upload Option -->
            <div class="mb-4">
              <label for="csv-file" class="block text-xs font-medium text-text-secondary mb-2">
                Option 1: Upload CSV File
              </label>
              <input
                id="csv-file"
                ref="csvFileInput"
                type="file"
                accept=".csv"
                @change="handleCSVFileSelect"
                class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary"
              />
            </div>

            <!-- Divider -->
            <div class="flex items-center my-4">
              <div class="flex-1 border-t border-border-input"></div>
              <span class="px-3 text-xs text-text-muted uppercase">or</span>
              <div class="flex-1 border-t border-border-input"></div>
            </div>

            <!-- Paste CSV Option -->
            <div>
              <label for="csv-text" class="block text-xs font-medium text-text-secondary mb-2">
                Option 2: Paste CSV Content
              </label>
              <textarea
                id="csv-text"
                ref="csvTextarea"
                v-model="csvPastedText"
                @input="handleCSVPaste"
                placeholder="Paste your CSV content here..."
                rows="6"
                class="w-full px-4 py-3 border border-border-input rounded-xl focus:ring-2 focus:ring-accent-warm focus:border-transparent outline-none bg-overlay text-text-primary font-mono text-sm"
              ></textarea>
            </div>
          </div>

          <div v-if="csvImportStatus" class="p-3 rounded-lg" :class="csvImportStatus.type === 'success' ? 'bg-status-success-bg text-status-success-text' : 'bg-status-error-bg text-status-error-text'">
            <p class="text-sm whitespace-pre-line">{{ csvImportStatus.message }}</p>
          </div>

          <div v-if="csvPreview.length > 0">
            <p class="text-sm font-medium text-text-secondary mb-2">Preview (first 5 rows):</p>
            <div class="border border-border-default rounded-lg overflow-hidden">
              <div class="overflow-x-auto max-h-64">
                <table class="min-w-full divide-y divide-divider text-sm">
                  <thead class="bg-sunken">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase">Reference</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase">Content</th>
                      <th v-if="csvPreview.some(r => r.version)" class="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase">Version</th>
                      <th v-if="csvPreview.some(r => r.daysUntilNextReview)" class="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase">Days Until Review</th>
                      <th v-if="csvPreview.some(r => r.interval)" class="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase">Interval</th>
                    </tr>
                  </thead>
                  <tbody class="bg-elevated divide-y divide-divider">
                    <tr v-for="(row, index) in csvPreview.slice(0, 5)" :key="index">
                      <td class="px-3 py-2 text-text-primary">{{ row.reference || '' }}</td>
                      <td class="px-3 py-2 text-text-primary">{{ (row.content || '').substring(0, 50) }}{{ (row.content || '').length > 50 ? '...' : '' }}</td>
                      <td v-if="csvPreview.some(r => r.version)" class="px-3 py-2 text-text-primary">{{ row.version || '' }}</td>
                      <td v-if="csvPreview.some(r => r.daysUntilNextReview)" class="px-3 py-2 text-text-primary">{{ row.daysUntilNextReview || '' }}</td>
                      <td v-if="csvPreview.some(r => r.interval)" class="px-3 py-2 text-text-primary">{{ row.interval || '' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p class="text-xs text-text-muted mt-2">Total rows: {{ csvPreview.length }}</p>
          </div>

          <!-- Collections selector (only when opening from collections screen) -->
          <CollectionPicker
            v-if="csvImportFromCollectionsScreen && collections.length > 0"
            :collections="collections"
            v-model="csvImportTargetCollectionIds"
            label="Add to collections"
          />
          <p v-if="csvImportFromCollectionsScreen && collections.length > 0" class="text-xs text-text-muted -mt-2">Select which collections to add imported verses to. Leave empty for master list only.</p>
        </div>

        <template #footer>
          <div class="flex justify-end space-x-3">
            <!-- Show Done button after successful import -->
            <button
              v-if="csvImportStatus && csvImportStatus.type === 'success'"
              type="button"
              @click="closeImportCSV"
              class="btn-primary"
            >
              Done
            </button>

            <!-- Show Cancel and Import buttons before/during import -->
            <template v-else>
              <button
                type="button"
                @click="closeImportCSV"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="importCSVVerses"
                :disabled="csvPreview.length === 0 || importingCSV"
                class="btn-primary"
              >
                {{ importingCSV ? 'Importing...' : `Import ${csvPreview.length} Verse${csvPreview.length !== 1 ? 's' : ''}` }}
              </button>
            </template>
          </div>
        </template>
      </ModalSheet>

      <ModalSheet :show="showPracticeSettings" title="Settings" data-testid="modal-practice-settings" max-width="sm:max-w-lg" @close="closePracticeSettings">
        <div class="space-y-4">
          <div class="rounded-2xl bg-sunken p-4">
            <label class="flex items-start gap-4 cursor-pointer">
              <div class="flex-1">
                <p class="text-base font-semibold text-text-primary">Require typing the reference after the verse</p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="appSettings.requireReferenceTyping"
                :class="[
                  'relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
                  appSettings.requireReferenceTyping ? 'bg-accent-strong' : 'bg-border-default'
                ]"
                @click="updateRequireReferenceTyping(!appSettings.requireReferenceTyping)"
              >
                <span
                  :class="[
                    'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 mt-1',
                    appSettings.requireReferenceTyping ? 'translate-x-6' : 'translate-x-1'
                  ]"
                />
              </button>
            </label>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <button
              @click="closePracticeSettings"
              class="btn-primary"
            >
              Done
            </button>
          </div>
        </template>
      </ModalSheet>

      <!-- Sync Settings Modal -->
      <SyncSettingsModal :show="showSettings" @close="closeSettings" @saved="onSyncSettingsSaved" />

      <!-- Backup & Restore Modal -->
      <ModalSheet :show="showBackupImport" title="Backup & Restore" data-testid="modal-backup-restore" @close="closeBackupImport">
        <div class="space-y-6">
          <!-- Last Backup Info -->
          <div class="bg-sunken rounded-xl p-4">
            <p class="text-sm text-text-secondary mb-1">Last backup:</p>
            <p class="text-lg font-medium text-text-primary">{{ getTimeSinceLastBackup() }}</p>
          </div>

          <!-- Backup Section -->
          <div>
            <h3 class="text-lg font-semibold text-text-primary mb-3">Backup All Data</h3>
            <p class="text-sm text-text-secondary mb-4">
              Download a backup file containing all your verses, collections, and settings.
            </p>
            <button
              @click="backupAllData"
              class="btn-primary w-full"
            >
              Download Backup
            </button>
          </div>

          <!-- Restore Section -->
          <div class="border-t border-border-default pt-6">
            <h3 class="text-lg font-semibold text-text-primary mb-3">Restore from Backup</h3>
            <p class="text-sm text-text-secondary mb-4">
              Restore your data from a previously saved backup file. This will replace all your current data.
            </p>
            <input
              type="file"
              accept=".json"
              @change="handleBackupFileSelect"
              class="hidden"
              ref="backupFileInput"
              id="backup-file-input"
            />
            <label
              for="backup-file-input"
              class="block w-full px-6 py-3 bg-sunken hover:bg-surface-hover text-text-secondary rounded-xl font-semibold text-center cursor-pointer transition-colors duration-200"
            >
              Choose Backup File
            </label>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <button
              @click="closeBackupImport"
              class="px-6 py-2.5 border border-border-input rounded-xl text-text-secondary hover:bg-surface-hover transition-colors duration-200 font-medium"
            >
              Close
            </button>
          </div>
        </template>
      </ModalSheet>

</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue'
import Fuse from 'fuse.js'
import { BibleClient } from '@gracious.tech/fetch-client'
import {
  syncData,
  markVerseDeleted,
  markCollectionDeleted,
  getDeletedCollections,
  isSyncConfigured,
  migrateProviderSetting,
  getActiveProviderId,
  setActiveProviderId,
  getActiveProvider
} from './sync/sync-manager.js'
import { getProvider, getAllProviders } from './sync/providers/index.js'
import { usePWAInstall } from './composables/usePWAInstall.js'
import { useColorScheme } from './composables/useColorScheme.js'
import { getAppSettings, getAppSettingsRecord, saveAppSettings, saveAppSettingsRecord } from './app-settings.js'
import {
  buildAboutUrl,
  dismissOnboarding as dismissOnboardingUiState,
  getCurrentAppUrl,
  hasLegacyAppPresence,
  getOnboardingUiState,
  markAppOpened,
  markPracticeModeHintSeen as persistPracticeModeHintSeen,
  updateOnboardingUiState,
  rememberAppUrl
} from './ui-state.js'
import { countVersesInReference, sumVerseReferenceCounts } from './utils/verse-count.js'
import { buildReferencePracticeUnits, normalizeReferenceForTyping } from './utils/reference-typing.js'
import { calculateGrade, wasReviewedToday, calculateNextReviewDate } from './srs.js'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import IOSInstallModal from './components/IOSInstallModal.vue'
import VersePracticeView from './components/VersePracticeView.vue'
import CompletionTray from './components/CompletionTray.vue'
import ModalSheet from './components/ModalSheet.vue'
import CollectionPicker from './components/CollectionPicker.vue'
import CollectionsAlmanac from './components/CollectionsAlmanac.vue'
import SyncSettingsModal from './components/SyncSettingsModal.vue'
import AppShell from './components/brand/AppShell.vue'
import BrandMark from './components/brand/BrandMark.vue'
import PrimaryButton from './components/brand/PrimaryButton.vue'
import SecondaryButton from './components/brand/SecondaryButton.vue'
import HeadwordReference from './components/brand/HeadwordReference.vue'
import POSBadge from './components/brand/POSBadge.vue'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
)

export default {
  name: 'App',
  components: { IOSInstallModal, VersePracticeView, CompletionTray, ModalSheet, CollectionPicker, CollectionsAlmanac, SyncSettingsModal, Line, Bar, AppShell, BrandMark, PrimaryButton, SecondaryButton, HeadwordReference, POSBadge },
  setup() {
    const verses = ref([])
    const collections = ref([])
    const showForm = ref(false)
    const showCollectionForm = ref(false)
    const showEditVerseForm = ref(false)
    const showEditCollectionForm = ref(false)
    const showPracticeSettings = ref(false)
    const showSettings = ref(false)
    const showSettingsMenu = ref(false)
    const appVersion = __APP_VERSION__
    const drawerVisible = ref(false)
    const drawerOpen = ref(false)
    const showBackupImport = ref(false)
    const showImportCSV = ref(false)
    const editingVerse = ref(null)
    const editingCollection = ref(null)
    const currentCollectionId = ref(null) // null = all verses, string = specific collection
    const currentView = ref('collections') // 'review-list', 'collections', or 'stats'
    const searchQuery = ref('')
    const searchActive = ref(false)
    const searchInputRef = ref(null)
    const reviewingVerse = ref(null)
    const reviewSourceList = ref(null) // Track the source list when starting a review
    const reviewSourceState = ref(null) // Track the original source navigation state
    const memorizingVerse = ref(null)
    const memorizationMode = ref(null) // 'learn', 'memorize', 'master'
    const memorizationSourceState = ref(null) // Track the original source navigation state for memorization
    const reviewWords = ref([])
    const typedLetter = ref('')
    const reviewInput = ref(null)
    const reviewTextContainer = ref(null)
    const memorizationPracticeRef = ref(null)
    const reviewPracticeRef = ref(null)
    const reviewInstanceKey = ref(0) // Bump on retry so VersePracticeView remounts (keyboard shows on Android PWA)
    const memorizationInstanceKey = ref(0)
    const memorizeRetryCount = ref(0) // Alternates which words are hidden on each retry in memorize mode
    const reviewMemorizeRetryCount = ref(0) // Same for review mode
    const reviewMistakes = ref(0) // Track mistakes during review
    const currentReviewSaved = ref(false) // Track if current review has been saved
    const firstAttemptGrade = ref(null) // Grade from first completed attempt (drives SRS regardless of accuracy)
    const firstAttemptMistakes = ref(null) // Mistakes from first completed attempt
    const isSpeaking = ref(false)
    const syncing = ref(false)
    const syncError = ref(null)
    const shareSuccess = ref(false)
    const fabMenuOpen = ref(false)
    const isScrolled = ref(false)
    const isDev = import.meta.env.DEV
    const csvFileInput = ref(null)
    const csvTextarea = ref(null)
    const csvPastedText = ref('')
    const backupFileInput = ref(null)
    const csvImportFromCollectionsScreen = ref(false)
    const csvImportTargetCollectionIds = ref([])
    const csvPreview = ref([])
    const csvImportStatus = ref(null)
    const importingCSV = ref(false)
    const expandedVerseIds = ref({})
    const toastState = ref({ show: false, message: '', isError: false })
    let toastTimeoutId = null
    let drawerHideTimeoutId = null
    const dailyActivityScrollRef = ref(null)
    const lastBackupTimestamp = ref(localStorage.getItem('rum1n8-last-backup'))
    const appSettings = ref(getAppSettings())
    const initialOnboardingUiState = getOnboardingUiState()
    const onboardingDismissed = ref(initialOnboardingUiState.onboardingDismissed)
    const practiceModeHintsSeen = ref(initialOnboardingUiState.practiceModeHintsSeen)
    const guidedOnboardingStep = ref(initialOnboardingUiState.guidedOnboardingStep)
    const guidedOnboardingVerseId = ref(initialOnboardingUiState.guidedOnboardingVerseId)
    const verseCardRefs = new Map()

    // Color scheme (auto dark/light mode)
    const { isDark } = useColorScheme()

    // PWA install
    const {
      isPWAInstalled,
      showIOSModal,
      triggerInstall,
      closeIOSModal
    } = usePWAInstall()

    // Bible verse import state
    const importingVerse = ref(false)
    const importError = ref(null)
    const importErrorShowLink = ref(false)
    const bibleClient = ref(null)
    const bibleCollection = ref(null)

    const newVerse = ref({
      reference: '',
      content: '',
      bibleVersion: '',
      collectionIds: []
    })

    const newCollection = ref({
      name: '',
      description: ''
    })

    const STORAGE_KEY = 'rum1n8-verses'
    const COLLECTIONS_KEY = 'rum1n8-collections'

    const saveAppSettingsLocally = (settings, shouldSync = true) => {
      const savedRecord = saveAppSettings(settings)
      appSettings.value = { ...savedRecord.appSettings }
      if (shouldSync) {
        triggerSync()
      }
      return savedRecord
    }

    const getLatestVerse = () => {
      if (verses.value.length === 0) return null

      return [...verses.value].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.lastModified || 0).getTime()
        const timeB = new Date(b.createdAt || b.lastModified || 0).getTime()
        return timeB - timeA
      })[0]
    }

    const applyOnboardingUiState = (state) => {
      onboardingDismissed.value = state.onboardingDismissed
      practiceModeHintsSeen.value = state.practiceModeHintsSeen
      guidedOnboardingStep.value = state.guidedOnboardingStep
      guidedOnboardingVerseId.value = state.guidedOnboardingVerseId
    }

    const persistOnboardingUiState = (patch = {}) => {
      const savedState = updateOnboardingUiState(patch)
      applyOnboardingUiState(getOnboardingUiState())
      return savedState
    }

    const syncLocalUiState = () => {
      const localUiState = getOnboardingUiState()
      const latestVerse = getLatestVerse()
      let nextStep = localUiState.guidedOnboardingStep
      let nextVerseId = localUiState.guidedOnboardingVerseId

      if (localUiState.onboardingDismissed) {
        nextStep = 'done'
        nextVerseId = null
      } else if (!nextStep) {
        nextStep = (!hasLegacyAppPresence() && verses.value.length === 0 && collections.value.length === 0)
          ? 'hero'
          : 'done'
      }

      if ((nextStep === 'tap-verse' || nextStep === 'practice') && !nextVerseId) {
        nextVerseId = latestVerse?.id || null
      }

      applyOnboardingUiState({
        ...localUiState,
        guidedOnboardingStep: nextStep,
        guidedOnboardingVerseId: nextVerseId,
      })

      if (
        nextStep !== localUiState.guidedOnboardingStep ||
        nextVerseId !== localUiState.guidedOnboardingVerseId
      ) {
        updateOnboardingUiState({
          guidedOnboardingStep: nextStep,
          guidedOnboardingVerseId: nextVerseId,
        })
      }
    }

    const setGuidedOnboardingStep = (step, verseId = guidedOnboardingVerseId.value) => {
      persistOnboardingUiState({
        guidedOnboardingStep: step,
        guidedOnboardingVerseId: verseId,
      })
    }

    const skipGuidedOnboarding = () => {
      dismissOnboardingUiState()
      applyOnboardingUiState(getOnboardingUiState())
    }

    const dismissReviewOnboardingTip = () => {
      setGuidedOnboardingStep('done', null)
    }

    const markCurrentPracticeModeHintSeen = (mode = memorizationMode.value) => {
      if (!mode || practiceModeHintsSeen.value?.[mode]) return
      persistPracticeModeHintSeen(mode)
      applyOnboardingUiState(getOnboardingUiState())
    }

    const dismissPracticeModesHint = () => {
      markCurrentPracticeModeHintSeen()
    }

    const setVerseCardRef = (verseId, el) => {
      if (el) {
        verseCardRefs.set(verseId, el)
        return
      }

      verseCardRefs.delete(verseId)
    }

    const scrollToOnboardingVerse = (behavior = 'smooth') => {
      nextTick(() => {
        const target = guidedOnboardingVerseId.value
          ? verseCardRefs.get(guidedOnboardingVerseId.value)
          : null

        target?.scrollIntoView({
          block: 'center',
          behavior,
        })
      })
    }

    const openHeroVerseModal = () => {
      showForm.value = true
    }

    // Navigation state tracking for back button handling
    let isHandlingBackButton = false
    
    // Get current navigation state
    const getNavigationState = () => {
      if (memorizingVerse.value) {
        return {
          view: 'memorization',
          verseId: memorizingVerse.value.id,
          mode: memorizationMode.value,
          collectionId: currentCollectionId.value
        }
      } else if (reviewingVerse.value) {
        return {
          view: 'review',
          verseId: reviewingVerse.value.id,
          collectionId: currentCollectionId.value
        }
      } else if (currentCollectionId.value) {
        return {
          view: 'collection',
          collectionId: currentCollectionId.value
        }
      } else {
        return {
          view: currentView.value
        }
      }
    }

    // Push history state when navigating
    const pushNavigationState = (state) => {
      if (isHandlingBackButton) return
      
      const url = new URL(window.location.href)
      url.searchParams.set('view', state.view)
      if (state.collectionId) {
        url.searchParams.set('collection', state.collectionId)
      }
      if (state.verseId) {
        url.searchParams.set('verse', state.verseId)
      }
      if (state.mode) {
        url.searchParams.set('mode', state.mode)
      }
      
      window.history.pushState(state, '', url)
      rememberAppUrl(`${url.pathname}${url.search}${url.hash}`)
    }

    // Replace history state (used when navigating sequentially without creating new history entries)
    const replaceNavigationState = (state) => {
      if (isHandlingBackButton) return
      
      const url = new URL(window.location.href)
      url.searchParams.set('view', state.view)
      if (state.collectionId) {
        url.searchParams.set('collection', state.collectionId)
      }
      if (state.verseId) {
        url.searchParams.set('verse', state.verseId)
      }
      if (state.mode) {
        url.searchParams.set('mode', state.mode)
      }
      
      window.history.replaceState(state, '', url)
      rememberAppUrl(`${url.pathname}${url.search}${url.hash}`)
    }

    // Restore app state from navigation state
    const restoreNavigationState = (state) => {
      isHandlingBackButton = true
      
      // Close any modals/forms first
      showForm.value = false
      showCollectionForm.value = false
      showEditVerseForm.value = false
      showSettings.value = false
      showImportCSV.value = false
      fabMenuOpen.value = false
      if (state.view !== 'search') {
        searchActive.value = false
        searchQuery.value = ''
      }
      
      // Restore collection view
      if (state.collectionId) {
        currentCollectionId.value = state.collectionId
      } else {
        currentCollectionId.value = null
      }
      
      // Restore main view (review-list, collections, or search) before starting review/memorization
      // so that startReview can determine the correct source list
      if (state.view === 'review-list' || state.view === 'collections' || state.view === 'search' || state.view === 'stats') {
        currentView.value = state.view
      } else if (state.view === 'collection') {
        // Collection view is handled above
      } else if (state.view === 'review' || state.view === 'memorization') {
        // If coming from review/memorization, try to determine the source view
        // If we have a collectionId, we came from a collection
        // Otherwise, default to collections (home screen)
        if (!state.collectionId) {
          currentView.value = 'collections'
        }
      } else {
        // Default to collections if no view specified
        currentView.value = 'collections'
      }
      
      // Restore memorization or review view
      if (state.view === 'memorization' && state.verseId) {
        const verse = verses.value.find(v => v.id === state.verseId)
        if (verse && state.mode) {
          startMemorization(verse, state.mode)
        }
      } else if (state.view === 'review' && state.verseId) {
        const verse = verses.value.find(v => v.id === state.verseId)
        if (verse) {
          startReview(verse)
        }
      } else {
        // Exit memorization/review if we're going back
        // Save review before exiting if it was completed (fallback — watcher usually handles this)
        if (reviewingVerse.value && !currentReviewSaved.value && allWordsRevealed.value && memorizationMode.value === 'master') {
          const verse = verses.value.find(v => v.id === reviewingVerse.value.id)
          if (verse) {
            const totalWords = totalPracticeUnitCount.value
            const grade = firstAttemptGrade.value !== null ? firstAttemptGrade.value : calculateGrade(totalWords, reviewMistakes.value)
            const mistakes = firstAttemptMistakes.value !== null ? firstAttemptMistakes.value : reviewMistakes.value

            // Check if verse was already reviewed today
            const wasAlreadyReviewedToday = wasReviewedToday(verse)

            // Only advance the spaced repetition schedule on the first review of the day
            if (!wasAlreadyReviewedToday) {
              const reviewData = calculateNextReviewDate(verse, grade, true)
              verse.reviewCount = (verse.reviewCount || 0) + 1
              verse.nextReviewDate = reviewData.nextReviewDate
              verse.easeFactor = reviewData.easeFactor
              verse.interval = reviewData.interval
            }

            // Always update tracking fields regardless of whether it was reviewed today
            const firstAttemptAccuracy = ((totalWords - mistakes) / totalWords * 100).toFixed(1)
            verse.lastReviewed = new Date().toISOString()
            verse.lastGrade = grade
            verse.lastAccuracy = firstAttemptAccuracy
            verse.lastModified = new Date().toISOString()

            // Track review history
            if (!verse.reviewHistory) verse.reviewHistory = []
            verse.reviewHistory.push({
              date: new Date().toISOString(),
              grade: grade,
              accuracy: parseFloat(firstAttemptAccuracy),
              mistakes: mistakes
            })

            currentReviewSaved.value = true
            saveVerses()
          }
        }
        
        memorizingVerse.value = null
        memorizationMode.value = null
        reviewingVerse.value = null
        reviewWords.value = []
        typedLetter.value = ''
        reviewMistakes.value = 0
        currentReviewSaved.value = false
      }
      
      // Use nextTick to ensure DOM updates before resetting flag
      nextTick(() => {
        rememberAppUrl(getCurrentAppUrl())
        isHandlingBackButton = false
      })
    }

    // Handle browser back/forward button
    const handlePopState = (event) => {
      if (event.state) {
        restoreNavigationState(event.state)
      } else {
        // If no state, restore to collections view
        restoreNavigationState({ view: 'collections' })
      }
    }

    // Initialize history state on mount
    const initializeHistory = () => {
      // Read URL params to restore view state
      const urlParams = new URLSearchParams(window.location.search)
      const viewParam = urlParams.get('view')
      let shouldNormalizeUrl = false
      
      if (viewParam === 'review-list' || viewParam === 'collections' || viewParam === 'search' || viewParam === 'stats') {
        currentView.value = viewParam
      } else if (viewParam === 'collection') {
        const collectionId = urlParams.get('collection')
        if (collectionId) {
          currentCollectionId.value = collectionId
        }
      } else if (viewParam === 'memorization' || viewParam === 'review') {
        // These are handled by restoreNavigationState
      } else {
        // Default to collections if no view param
        currentView.value = 'collections'
        shouldNormalizeUrl = !!viewParam
      }
      
      const initialState = getNavigationState()
      if (shouldNormalizeUrl) {
        replaceNavigationState(initialState)
      } else {
        window.history.replaceState(initialState, '', window.location.href)
      }
      window.addEventListener('popstate', handlePopState)
    }

    // Computed properties
    const revealedCount = computed(() => {
      return reviewWords.value.filter(w => w.revealed).length
    })

    const totalPracticeUnitCount = computed(() => {
      return reviewWords.value.length
    })

    const isLibraryEmpty = computed(() => {
      return verses.value.length === 0 && collections.value.length === 0
    })

    const shouldShowHeroOnboarding = computed(() => {
      return (
        guidedOnboardingStep.value === 'hero' &&
        currentView.value === 'collections' &&
        !currentCollectionId.value &&
        isLibraryEmpty.value &&
        !onboardingDismissed.value
      )
    })

    const onboardingTargetVerse = computed(() => {
      if (!guidedOnboardingVerseId.value) return null
      return verses.value.find((verse) => verse.id === guidedOnboardingVerseId.value) || null
    })

    const shouldShowVerseOnboardingCallout = computed(() => {
      return (
        (guidedOnboardingStep.value === 'tap-verse' || guidedOnboardingStep.value === 'practice') &&
        currentView.value === 'collections' &&
        !currentCollectionId.value &&
        !memorizingVerse.value &&
        !reviewingVerse.value &&
        !!onboardingTargetVerse.value
      )
    })

    const shouldShowGuidedOnboardingScrim = computed(() => {
      return shouldShowReviewTabCallout.value
    })

    const allWordsRevealed = computed(() => {
      if (reviewWords.value.length === 0) return false
      return reviewWords.value.every(w => w.revealed)
    })

    // Calculate accuracy percentage
    const accuracy = computed(() => {
      if (totalPracticeUnitCount.value === 0) return 0
      return ((totalPracticeUnitCount.value - reviewMistakes.value) / totalPracticeUnitCount.value) * 100
    })

    // Check if accuracy meets the 90% requirement
    const meetsAccuracyRequirement = computed(() => {
      return accuracy.value >= 90
    })

    const reviewingVerseNextReviewLabel = computed(() => {
      if (!reviewingVerse.value) return null
      const verse = verses.value.find(v => v.id === reviewingVerse.value.id)
      if (!verse) return null
      return getTimeUntilReview(verse)
    })

    const isGuidedPracticeOnboardingActive = computed(() => {
      return ['practice', 'review-tab', 'review-tip'].includes(guidedOnboardingStep.value)
    })

    const shouldShowPracticeModesHint = computed(() => {
      return (
        isGuidedPracticeOnboardingActive.value &&
        !!memorizationMode.value &&
        (!!memorizingVerse.value || !!reviewingVerse.value) &&
        !practiceModeHintsSeen.value?.[memorizationMode.value]
      )
    })

    const shouldShowReviewTabCallout = computed(() => {
      return (
        guidedOnboardingStep.value === 'review-tab' &&
        !memorizingVerse.value &&
        !reviewingVerse.value &&
        !currentCollectionId.value
      )
    })

    const shouldShowReviewOnboardingTip = computed(() => {
      return guidedOnboardingStep.value === 'review-tip' && currentView.value === 'review-list'
    })

    // When a review attempt completes (all words revealed) for the first time,
    // capture the grade and save SRS immediately — even if accuracy is below 90%.
    // The user must still retry to reach 90% to proceed, but the SRS schedule
    // reflects the honest first-attempt performance, not a polished retry.
    watch(allWordsRevealed, (revealed) => {
      if (!revealed || !reviewingVerse.value || memorizationMode.value !== 'master') return
      if (firstAttemptGrade.value !== null) return // Already captured

      const totalWords = totalPracticeUnitCount.value
      const grade = calculateGrade(totalWords, reviewMistakes.value)
      firstAttemptGrade.value = grade
      firstAttemptMistakes.value = reviewMistakes.value

      // Save SRS immediately from first attempt
      const verse = verses.value.find(v => v.id === reviewingVerse.value.id)
      if (!verse) return

      const wasAlreadyReviewedToday = wasReviewedToday(verse)

      if (!wasAlreadyReviewedToday) {
        const reviewData = calculateNextReviewDate(verse, grade, true)
        verse.reviewCount = (verse.reviewCount || 0) + 1
        verse.nextReviewDate = reviewData.nextReviewDate
        verse.easeFactor = reviewData.easeFactor
        verse.interval = reviewData.interval
      }

      const firstAttemptAccuracy = ((totalWords - reviewMistakes.value) / totalWords * 100).toFixed(1)
      verse.lastReviewed = new Date().toISOString()
      verse.lastGrade = grade
      verse.lastAccuracy = firstAttemptAccuracy
      verse.lastModified = new Date().toISOString()

      if (!verse.reviewHistory) verse.reviewHistory = []
      verse.reviewHistory.push({
        date: new Date().toISOString(),
        grade: grade,
        accuracy: parseFloat(firstAttemptAccuracy),
        mistakes: reviewMistakes.value
      })

      currentReviewSaved.value = true
      saveVerses()
    })

    // When completion tray appears, scroll verse content so end of verse is visible
    watch(allWordsRevealed, (revealed) => {
      if (!revealed) return
      dismissPracticeModesHint()
      nextTick(() => {
        const practiceRef = memorizingVerse.value ? memorizationPracticeRef.value : reviewPracticeRef.value
        practiceRef?.scrollToEnd?.()
      })
    })

    watch([shouldShowVerseOnboardingCallout, guidedOnboardingVerseId], ([shouldShow]) => {
      if (!shouldShow) return
      scrollToOnboardingVerse()
    })

    watch([guidedOnboardingStep, isLibraryEmpty], ([step, libraryEmpty]) => {
      if (step !== 'hero' || libraryEmpty) return
      setGuidedOnboardingStep('done', null)
    })

    watch([onboardingTargetVerse, guidedOnboardingStep, isLibraryEmpty], ([targetVerse, step, libraryEmpty]) => {
      if (step !== 'tap-verse' && step !== 'practice') return
      if (targetVerse) return

      const latestVerse = getLatestVerse()

      if (latestVerse) {
        setGuidedOnboardingStep(step, latestVerse.id)
        return
      }

      if (!onboardingDismissed.value && libraryEmpty) {
        setGuidedOnboardingStep('hero', null)
        return
      }

      setGuidedOnboardingStep('done', null)
    })

    // Count verses due for review
    const dueVersesCount = computed(() => {
      return verses.value.filter(v => isDueForReview(v)).length
    })

    // Total verse count accounting for ranges (e.g., "Psalm 1:1-3" = 3 verses)
    const totalVerseCount = computed(() => {
      return sumVerseReferenceCounts(verses.value)
    })

    // Check if "No Collection" has any verses
    const hasNoCollectionVerses = computed(() => {
      return verses.value.some(v => {
        const ids = v.collectionIds
        return !ids || (Array.isArray(ids) && ids.length === 0)
      })
    })

    // Check if "To Learn" has any verses
    const hasToLearnVerses = computed(() => {
      return verses.value.some(v => v.memorizationStatus !== 'mastered')
    })

    // --- Stats computeds ---

    const masteredCount = computed(() =>
      sumVerseReferenceCounts(
        verses.value.filter(v => v.memorizationStatus === 'mastered')
      )
    )

    const currentStreak = computed(() => {
      const reviewDatesSet = new Set()
      verses.value.forEach(v => {
        if (v.reviewHistory) {
          v.reviewHistory.forEach(r => {
            // Use local date to avoid timezone issues
            const d = new Date(r.date)
            const localDate = d.getFullYear() + '-' +
              String(d.getMonth() + 1).padStart(2, '0') + '-' +
              String(d.getDate()).padStart(2, '0')
            reviewDatesSet.add(localDate)
          })
        }
      })

      if (reviewDatesSet.size === 0) return 0

      const now = new Date()
      const todayStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0')

      const yesterdayDate = new Date(now)
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterdayStr = yesterdayDate.getFullYear() + '-' +
        String(yesterdayDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(yesterdayDate.getDate()).padStart(2, '0')

      // Streak must include today or yesterday to be active
      if (!reviewDatesSet.has(todayStr) && !reviewDatesSet.has(yesterdayStr)) return 0

      let streak = 0
      let checkDate = new Date(now)
      // Start from today if reviewed today, otherwise from yesterday
      if (!reviewDatesSet.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1)
      }

      while (true) {
        const dateStr = checkDate.getFullYear() + '-' +
          String(checkDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(checkDate.getDate()).padStart(2, '0')
        if (reviewDatesSet.has(dateStr)) {
          streak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else {
          break
        }
      }

      return streak
    })

    const masteredOverTimeData = computed(() => {
      const countByDate = {}
      verses.value.forEach(v => {
        if (v.memorizationStatus === 'mastered' && v.masteredAt) {
          const d = v.masteredAt.substring(0, 10)
          const verseCount = countVersesInReference(v.reference)
          countByDate[d] = (countByDate[d] || 0) + verseCount
        }
      })
      const allDates = Object.keys(countByDate).sort()
      if (allDates.length === 0) return { labels: [], data: [] }

      const labels = []
      const data = []
      let cumulative = 0
      allDates.forEach(d => {
        cumulative += countByDate[d]
        labels.push(d)
        data.push(cumulative)
      })
      return { labels, data }
    })

    const dailyActivityData = computed(() => {
      const reviewsByDate = {}
      const masteredByDate = {}

      // Only show last 30 days
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const cutoffStr = cutoff.toISOString().substring(0, 10)

      verses.value.forEach(v => {
        const verseCount = countVersesInReference(v.reference)
        if (v.reviewHistory) {
          v.reviewHistory.forEach(r => {
            const date = r.date.substring(0, 10)
            if (date >= cutoffStr) {
              reviewsByDate[date] = (reviewsByDate[date] || 0) + verseCount
            }
          })
        }
        if (v.memorizationStatus === 'mastered' && v.masteredAt) {
          const d = v.masteredAt.substring(0, 10)
          if (d >= cutoffStr) {
            masteredByDate[d] = (masteredByDate[d] || 0) + verseCount
          }
        }
      })

      const allDates = [...new Set([
        ...Object.keys(reviewsByDate),
        ...Object.keys(masteredByDate)
      ])].sort()

      return {
        labels: allDates,
        reviews: allDates.map(d => reviewsByDate[d] || 0),
        mastered: allDates.map(d => masteredByDate[d] || 0)
      }
    })

    // Chart helpers
    const getCssVar = (name) => {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    }

    const chartColors = computed(() => {
      // isDark.value is read here to trigger reactivity on theme change
      const _ = isDark.value
      return {
        text: getCssVar('--color-text-secondary'),
        muted: getCssVar('--color-text-muted'),
        grid: getCssVar('--color-border-default'),
        accent: getCssVar('--color-accent'),
        success: getCssVar('--color-accent-warm'),
      }
    })

    const masteredChartData = computed(() => ({
      labels: masteredOverTimeData.value.labels.map(d =>
        new Date(d + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
      ),
      datasets: [{
        label: 'Mastered',
        data: masteredOverTimeData.value.data,
        borderColor: chartColors.value.accent,
        backgroundColor: chartColors.value.accent + '20',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 0
      }]
    }))

    const lineChartOptions = computed(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          ticks: { color: chartColors.value.muted, maxTicksLimit: 6 },
          grid: { color: chartColors.value.grid + '40' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: chartColors.value.muted, precision: 0 },
          grid: { color: chartColors.value.grid + '40' }
        }
      }
    }))

    const dailyBarChartData = computed(() => ({
      labels: dailyActivityData.value.labels.map(d =>
        new Date(d + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
      ),
      datasets: [
        {
          label: 'Reviews',
          data: dailyActivityData.value.reviews,
          backgroundColor: chartColors.value.accent + 'AA',
          borderRadius: 4
        },
        {
          label: 'Mastered',
          data: dailyActivityData.value.mastered,
          backgroundColor: chartColors.value.success + 'AA',
          borderRadius: 4
        }
      ]
    }))

    const dailyActivityMax = computed(() => {
      const data = dailyActivityData.value
      let max = 0
      for (let i = 0; i < data.labels.length; i++) {
        const total = (data.reviews[i] || 0) + (data.mastered[i] || 0)
        if (total > max) max = total
      }
      return Math.max(max, 1)
    })

    const yAxisLabels = computed(() => {
      const max = dailyActivityMax.value
      // Generate ~4 evenly spaced labels from max down to 0
      const step = Math.ceil(max / 4) || 1
      const labels = []
      for (let v = Math.ceil(max / step) * step; v >= 0; v -= step) {
        labels.push(v)
      }
      return labels
    })

    const barChartOptions = computed(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: chartColors.value.muted, maxRotation: 45, font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { display: false },
          grid: { color: chartColors.value.grid + '40' }
        }
      }
    }))

    // Auto-scroll daily activity chart to the right when stats view is shown
    watch(currentView, (view) => {
      if (view === 'review-list' && guidedOnboardingStep.value === 'review-tab') {
        setGuidedOnboardingStep('review-tip', guidedOnboardingVerseId.value)
      }

      if (view === 'stats') {
        nextTick(() => {
          if (dailyActivityScrollRef.value) {
            dailyActivityScrollRef.value.scrollLeft = dailyActivityScrollRef.value.scrollWidth
          }
        })
      }
    })

    // Biblical book order for sorting
    const bookOrder = {
      // Old Testament
      'genesis': 1, 'gen': 1,
      'exodus': 2, 'ex': 2, 'exo': 2,
      'leviticus': 3, 'lev': 3,
      'numbers': 4, 'num': 4,
      'deuteronomy': 5, 'deut': 5,
      'joshua': 6, 'josh': 6,
      'judges': 7, 'judg': 7,
      'ruth': 8,
      '1 samuel': 9, '1sam': 9, '1 sam': 9,
      '2 samuel': 10, '2sam': 10, '2 sam': 10,
      '1 kings': 11, '1kings': 11, '1 ki': 11,
      '2 kings': 12, '2kings': 12, '2 ki': 12,
      '1 chronicles': 13, '1chron': 13, '1 chron': 13,
      '2 chronicles': 14, '2chron': 14, '2 chron': 14,
      'ezra': 15,
      'nehemiah': 16, 'neh': 16,
      'esther': 17, 'est': 17,
      'job': 18,
      'psalms': 19, 'psalm': 19, 'ps': 19,
      'proverbs': 20, 'prov': 20,
      'ecclesiastes': 21, 'eccl': 21,
      'song of solomon': 22, 'song': 22,
      'isaiah': 23, 'isa': 23,
      'jeremiah': 24, 'jer': 24,
      'lamentations': 25, 'lam': 25,
      'ezekiel': 26, 'ezek': 26,
      'daniel': 27, 'dan': 27,
      'hosea': 28, 'hos': 28,
      'joel': 29,
      'amos': 30,
      'obadiah': 31, 'obad': 31,
      'jonah': 32,
      'micah': 33, 'mic': 33,
      'nahum': 34, 'nah': 34,
      'habakkuk': 35, 'hab': 35,
      'zephaniah': 36, 'zeph': 36,
      'haggai': 37, 'hag': 37,
      'zechariah': 38, 'zech': 38,
      'malachi': 39, 'mal': 39,
      // New Testament
      'matthew': 40, 'matt': 40, 'mat': 40, 'mt': 40,
      'mark': 41, 'mk': 41,
      'luke': 42, 'lk': 42,
      'john': 43, 'jn': 43,
      'acts': 44,
      'romans': 45, 'rom': 45,
      '1 corinthians': 46, '1cor': 46, '1 cor': 46,
      '2 corinthians': 47, '2cor': 47, '2 cor': 47,
      'galatians': 48, 'gal': 48,
      'ephesians': 49, 'eph': 49,
      'philippians': 50, 'phil': 50,
      'colossians': 51, 'col': 51,
      '1 thessalonians': 52, '1thess': 52, '1 thess': 52,
      '2 thessalonians': 53, '2thess': 53, '2 thess': 53,
      '1 timothy': 54, '1tim': 54, '1 tim': 54,
      '2 timothy': 55, '2tim': 55, '2 tim': 55,
      'titus': 56,
      'philemon': 57, 'phlm': 57,
      'hebrews': 58, 'heb': 58,
      'james': 59, 'jas': 59,
      '1 peter': 60, '1pet': 60, '1 pet': 60,
      '2 peter': 61, '2pet': 61, '2 pet': 61,
      '1 john': 62, '1jn': 62, '1 jn': 62,
      '2 john': 63, '2jn': 63, '2 jn': 63,
      '3 john': 64, '3jn': 64, '3 jn': 64,
      'jude': 65,
      'revelation': 66, 'rev': 66
    }

    // Parse verse reference into sortable components
    const parseReference = (reference) => {
      if (!reference) return { book: 999, chapter: 0, verse: 0 }
      
      // Match patterns like "Matthew 24:1" or "1 John 3:16" or "Psalm 119:105"
      const match = reference.match(/^((?:\d\s)?[a-z]+)\s+(\d+):(\d+)/i)
      
      if (match) {
        const bookName = match[1].toLowerCase().trim()
        const chapter = parseInt(match[2], 10)
        const verse = parseInt(match[3], 10)
        const bookNum = bookOrder[bookName] || 999
        
        return { book: bookNum, chapter, verse }
      }
      
      // If no match, return high numbers to sort to the end
      return { book: 999, chapter: 0, verse: 0 }
    }

    // Filtered verses for current view
    const filteredVerses = computed(() => {
      return getVersesForView()
    })

    // Sort filtered verses by biblical reference
    const sortedVerses = computed(() => {
      const versesToSort = filteredVerses.value
      return [...versesToSort].sort((a, b) => {
        const aParsed = parseReference(a.reference)
        const bParsed = parseReference(b.reference)
        
        // Sort by book
        if (aParsed.book !== bParsed.book) {
          return aParsed.book - bParsed.book
        }
        
        // Then by chapter
        if (aParsed.chapter !== bParsed.chapter) {
          return aParsed.chapter - bParsed.chapter
        }
        
        // Then by verse
        return aParsed.verse - bParsed.verse
      })
    })

    // Initialize Fuse.js for fuzzy search
    const fuseOptions = {
      keys: [
        { name: 'reference', weight: 0.4 },
        { name: 'content', weight: 0.6 }
      ],
      threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
      includeMatches: true,
      includeScore: true,
      minMatchCharLength: 1
    }
    
    // Create Fuse instance (will be recreated when verses change)
    const getFuseInstance = () => {
      return new Fuse(verses.value, fuseOptions)
    }

    // Search results using Fuse.js
    const searchResults = computed(() => {
      if (!searchQuery.value.trim()) {
        return []
      }
      
      const query = searchQuery.value.trim()

      const fuse = getFuseInstance()
      const results = fuse.search(query)

      // Include verses that contain the full query in content (case-insensitive) when Fuse
      // excludes them due to long-content scoring (e.g. "if you who are evil" in Luke 11:9-13).
      const resultIds = new Set(results.map(r => r.item.id))
      const queryLower = query.toLowerCase()
      const substringMatches = verses.value.filter(
        v => !resultIds.has(v.id) && (v.content || '').toLowerCase().includes(queryLower)
      )
      substringMatches.forEach(v => {
        resultIds.add(v.id)
        const content = v.content || ''
        const start = content.toLowerCase().indexOf(queryLower)
        const end = start >= 0 ? start + query.length - 1 : -1
        const matches = start >= 0
          ? [{ key: 'content', indices: [[start, end]] }]
          : []
        results.push({ item: v, matches, score: 0 })
      })
      results.sort((a, b) => (a.score ?? 1) - (b.score ?? 1))

      return results.map(result => ({
        item: result.item,
        matches: result.matches || [],
        score: result.score
      }))
    })

    // Sort verses by next review date (closest first) for review list
    const reviewSortedVerses = computed(() => {
      // Filter to only verses with nextReviewDate (mastered verses)
      const versesWithReviewDate = verses.value.filter(v => v.nextReviewDate)
      
      return [...versesWithReviewDate].sort((a, b) => {
        const dateA = new Date(a.nextReviewDate)
        const dateB = new Date(b.nextReviewDate)
        // Sort ascending (closest date first)
        return dateA - dateB
      })
    })

    // Reactive trigger for sync config changes (localStorage isn't reactive)
    const syncConfigVersion = ref(0)

    // Check if any sync provider is configured
    const hasSyncConfigured = computed(() => {
      syncConfigVersion.value // track dependency
      return isSyncConfigured()
    })

    // Get last backup timestamp (reactive)
    const getLastBackupTimestamp = () => {
      return lastBackupTimestamp.value || null
    }

    // Get time since last backup as formatted string
    const getTimeSinceLastBackup = () => {
      const timestamp = getLastBackupTimestamp()
      if (!timestamp) {
        return 'Never backed up'
      }
      
      const lastBackup = new Date(timestamp)
      const now = new Date()
      const diffMs = now - lastBackup
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      
      if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
      } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
      } else {
        return 'Just now'
      }
    }

    // Check if backup reminder should be shown
    const shouldShowBackupReminder = computed(() => {
      // Only show if WebDAV is not configured
      if (hasSyncConfigured.value) {
        return false
      }
      
      const timestamp = getLastBackupTimestamp()
      if (!timestamp) {
        // Never backed up
        return true
      }
      
      // Check if last backup is more than 7 days ago
      const lastBackup = new Date(timestamp)
      const now = new Date()
      const diffMs = now - lastBackup
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      
      return diffDays > 7
    })

    // Load collections from local storage
    const loadCollections = () => {
      const stored = localStorage.getItem(COLLECTIONS_KEY)
      if (stored) {
        const loadedCollections = JSON.parse(stored)
        let needsMigration = false
        // Migrate existing collections to include lastModified
        collections.value = loadedCollections.map(collection => {
          // Add lastModified if missing (use createdAt or current time as fallback)
          if (!collection.hasOwnProperty('lastModified')) {
            collection.lastModified = collection.createdAt || new Date().toISOString()
            needsMigration = true
          }
          return collection
        })
        // Only save if we actually migrated something (and avoid triggering sync during load)
        if (needsMigration) {
          localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections.value))
        }
      }
    }

    // Save collections to local storage
    const saveCollections = () => {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections.value))
      // Trigger sync after save
      triggerSync()
    }

    // Load verses from local storage
    const loadVerses = () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const loadedVerses = JSON.parse(stored)
        // Migrate existing verses to include review fields
        verses.value = loadedVerses.map(verse => {
          if (!verse.hasOwnProperty('reviewCount')) {
            verse.reviewCount = 0
            verse.lastReviewed = null
            verse.nextReviewDate = verse.createdAt || new Date().toISOString()
            verse.easeFactor = 2.5 // Default ease factor
            verse.interval = 0
            verse.reviewHistory = []
          }
          // Ensure all new fields exist
          if (!verse.hasOwnProperty('easeFactor')) verse.easeFactor = 2.5
          if (!verse.hasOwnProperty('interval')) verse.interval = 0
          if (!verse.hasOwnProperty('reviewHistory')) verse.reviewHistory = []
          // Set memorization status - if it has reviews, it's mastered, otherwise unmemorized
          if (!verse.hasOwnProperty('memorizationStatus')) {
            verse.memorizationStatus = (verse.reviewCount > 0) ? 'mastered' : 'unmemorized'
          }
          // If unmemorized, clear nextReviewDate
          if (verse.memorizationStatus === 'unmemorized') {
            verse.nextReviewDate = null
          }
          // Add collectionIds if missing
          if (!verse.hasOwnProperty('collectionIds')) {
            verse.collectionIds = []
          }
          // Add bibleVersion if missing
          if (!verse.hasOwnProperty('bibleVersion')) {
            verse.bibleVersion = ''
          }
          // Add lastModified if missing (use createdAt or current time as fallback)
          if (!verse.hasOwnProperty('lastModified')) {
            verse.lastModified = verse.lastReviewed || verse.createdAt || new Date().toISOString()
          }
          // Add masteredAt if missing
          if (!verse.hasOwnProperty('masteredAt')) {
            if (verse.memorizationStatus === 'mastered') {
              verse.masteredAt = verse.createdAt || new Date().toISOString()
            } else {
              verse.masteredAt = null
            }
          }
          return verse
        })
        saveVerses() // Save migrated data
      }
    }

    // Save verses to local storage
    const saveVerses = () => {
      console.log('[saveVerses] Saving verses to localStorage', {
        totalVerses: verses.value.length,
        timestamp: new Date().toISOString()
      })
      
      // Find the verse we just updated to verify it's in the array
      const reviewingId = reviewingVerse.value?.id
      if (reviewingId) {
        const verseToCheck = verses.value.find(v => v.id === reviewingId)
        console.log('[saveVerses] Verse being saved', {
          id: verseToCheck?.id,
          reference: verseToCheck?.reference,
          lastReviewed: verseToCheck?.lastReviewed,
          reviewCount: verseToCheck?.reviewCount,
          interval: verseToCheck?.interval
        })
      }
      
      const serialized = JSON.stringify(verses.value)
      localStorage.setItem(STORAGE_KEY, serialized)
      
      // Verify what was actually saved
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && reviewingId) {
        try {
          const parsed = JSON.parse(saved)
          const savedVerse = parsed.find((v) => v.id === reviewingId)
          console.log('[saveVerses] Verified saved data', {
            found: !!savedVerse,
            lastReviewed: savedVerse?.lastReviewed,
            reviewCount: savedVerse?.reviewCount
          })
        } catch (e) {
          console.error('[saveVerses] Error parsing saved data', e)
        }
      }
      
      // Trigger sync after save
      triggerSync()
    }

    // Get adjacent keys on QWERTY keyboard for fuzzy typing
    const getAdjacentKeys = (letter) => {
      const qwertyLayout = {
        // Row 1
        'q': ['w', 'a'],
        'w': ['q', 'e', 'a', 's'],
        'e': ['w', 'r', 's', 'd'],
        'r': ['e', 't', 'd', 'f'],
        't': ['r', 'y', 'f', 'g'],
        'y': ['t', 'u', 'g', 'h'],
        'u': ['y', 'i', 'h', 'j'],
        'i': ['u', 'o', 'j', 'k'],
        'o': ['i', 'p', 'k', 'l'],
        'p': ['o', 'l'],
        // Row 2
        'a': ['q', 'w', 's', 'z'],
        's': ['a', 'w', 'e', 'd', 'x', 'z'],
        'd': ['s', 'e', 'r', 'f', 'c', 'x'],
        'f': ['d', 'r', 't', 'g', 'v', 'c'],
        'g': ['f', 't', 'y', 'h', 'b', 'v'],
        'h': ['g', 'y', 'u', 'j', 'n', 'b'],
        'j': ['h', 'u', 'i', 'k', 'm', 'n'],
        'k': ['j', 'i', 'o', 'l', 'm'],
        'l': ['k', 'o', 'p'],
        // Row 3
        'z': ['a', 's', 'x'],
        'x': ['z', 's', 'd', 'c'],
        'c': ['x', 'd', 'f', 'v'],
        'v': ['c', 'f', 'g', 'b'],
        'b': ['v', 'g', 'h', 'n'],
        'n': ['b', 'h', 'j', 'm'],
        'm': ['n', 'j', 'k']
      }
      return qwertyLayout[letter.toLowerCase()] || []
    }

    // Indices in text where typeable characters appear (for partial display in words and references)
    const getLetterIndices = (text) => {
      const indices = []
      for (let i = 0; i < text.length; i++) {
        if (/[a-zA-Z0-9]/.test(text[i])) indices.push(i)
      }
      return indices
    }

    // First letter of each hyphen part (one key reveals whole word). For "peace-loving" returns ["p","l"], for "hello" returns ["h"].
    const getRequiredLetters = (word) => {
      const parts = word.split(/[-\u2010-\u2015]/)
      const requiredLetters = []
      for (const part of parts) {
        const trimmedPart = part.trim()
        if (trimmedPart.length > 0) {
          const firstLetterMatch = trimmedPart.match(/[a-zA-Z]/)
          if (firstLetterMatch) requiredLetters.push(firstLetterMatch[0].toLowerCase())
        }
      }
      if (requiredLetters.length === 0) {
        const firstChar = word.trim().charAt(0)
        if (firstChar) requiredLetters.push(firstChar.toLowerCase())
      }
      return requiredLetters
    }

    const shouldRequireReferenceTyping = (verse) => {
      return !!(appSettings.value.requireReferenceTyping && normalizeReferenceForTyping(verse?.reference))
    }

    // Expand verse content into words, splitting tokens that contain dashes into separate entries.
    // "God—created" (no spaces around dash) becomes two words so each requires its own letter to reveal.
    const getVerseWords = (content) => {
      const spaceSplitTokens = content.split(/\s+/).filter(w => w.trim().length > 0)
      const result = []
      for (const token of spaceSplitTokens) {
        const { parts, separators } = splitWordParts(token)
        if (parts.length > 1) {
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            if (part.trim().length > 0) {
              result.push({ text: part, separatorAfter: separators[i] || '' })
            }
          }
        } else {
          result.push({ text: token, separatorAfter: '' })
        }
      }
      return result
    }

    const buildContentPracticeWords = (content, mode, retryOffset = 0) => {
      const wordEntries = getVerseWords(content)
      return wordEntries.map((entry, index) => {
        const word = entry.text
        const requiredLetters = getRequiredLetters(word)
        const firstLetter = requiredLetters[0]
        const { parts, separators } = splitWordParts(word)

        let visible = false
        if (mode === 'learn') {
          visible = true
        } else if (mode === 'memorize') {
          visible = (index + retryOffset) % 2 === 0
        }

        return {
          text: word,
          separatorAfter: entry.separatorAfter,
          revealed: false,
          visible,
          firstLetter,
          requiredLetters,
          typedLettersIndex: 0,
          parts,
          separators,
          index,
          incorrect: false,
          incorrectLetterIndices: []
        }
      })
    }

    const resetPracticeSequence = (verse, mode, retryOffset = 0) => {
      const contentWords = buildContentPracticeWords(verse.content, mode, retryOffset)
      const referenceWords = shouldRequireReferenceTyping(verse)
        ? buildReferencePracticeUnits(verse.reference).map((unit) => ({
            ...unit,
            visible: mode === 'learn'
          }))
        : []
      reviewWords.value = [...contentWords, ...referenceWords].map((word, index) => ({
        ...word,
        index
      }))
      typedLetter.value = ''
    }

    // Split word into parts by hyphens and get the separator characters
    // Returns { parts: ["peace", "loving"], separators: ["-"] }
    const splitWordParts = (word) => {
      // Find all hyphen/dash characters and their positions
      const separators = []
      const parts = []
      let lastIndex = 0
      
      // Match all types of hyphens and dashes (U+002D, U+2010-U+2015)
      const separatorRegex = /[-\u2010-\u2015]/g
      let match
      
      while ((match = separatorRegex.exec(word)) !== null) {
        parts.push(word.substring(lastIndex, match.index))
        separators.push(match[0])
        lastIndex = match.index + match[0].length
      }
      parts.push(word.substring(lastIndex))
      
      return { parts, separators }
    }

    // Get partial word text based on how many letters have been typed
    // For letter-by-letter: "eternal" with typedLettersIndex=3, returns "ete"
    // For hyphenated "peace-loving": typedLettersIndex=1 returns "peace-", typedLettersIndex=2 returns "peace-loving"
    const getPartialWordText = (word) => {
      if (!word.requiredLetters || word.requiredLetters.length <= 1) {
        return ''
      }
      
      const typedLettersIndex = word.typedLettersIndex || 0
      if (typedLettersIndex >= word.requiredLetters.length) return word.text
      if (typedLettersIndex === 0) return ''

      let parts = word.parts
      let separators = word.separators
      if (!parts || !separators) {
        const split = splitWordParts(word.text)
        parts = split.parts
        separators = split.separators
      }

      // Reference tokens should reveal strictly by typed alphanumeric characters,
      // not by hyphen-separated parts like verse words do.
      if (word.isReferenceUnit) {
        const indices = getLetterIndices(word.text)
        const endIdx = indices[typedLettersIndex - 1] + 1
        return word.text.substring(0, endIdx)
      }

      // Single part (no hyphen): show first typedLettersIndex letters by character position
      if (parts.length === 1) {
        const indices = getLetterIndices(word.text)
        const endIdx = indices[typedLettersIndex - 1] + 1
        return word.text.substring(0, endIdx)
      }
      
      // Hyphenated: build partial text up to the current part
      let partialText = ''
      for (let i = 0; i < typedLettersIndex && i < parts.length; i++) {
        if (i > 0 && separators[i - 1]) partialText += separators[i - 1]
        partialText += parts[i]
      }
      if (typedLettersIndex < parts.length && separators.length > 0 && separators[typedLettersIndex - 1]) {
        partialText += separators[typedLettersIndex - 1]
      }
      return partialText
    }

    // Get remaining (untyped) part of a word
    // For letter-by-letter: "eternal" with typedLettersIndex=3, returns "rnal"
    const getRemainingPartText = (word) => {
      if (!word.requiredLetters || word.requiredLetters.length <= 1) {
        return word.text
      }
      
      const typedLettersIndex = word.typedLettersIndex || 0
      if (typedLettersIndex >= word.requiredLetters.length) return ''
      if (typedLettersIndex === 0) return word.text

      let parts = word.parts
      let separators = word.separators
      if (!parts || !separators) {
        const split = splitWordParts(word.text)
        parts = split.parts
        separators = split.separators
      }

      // Reference tokens should keep punctuation in place while only revealing
      // characters that have actually been typed.
      if (word.isReferenceUnit) {
        const indices = getLetterIndices(word.text)
        const startIdx = indices[typedLettersIndex - 1] + 1
        return word.text.substring(startIdx)
      }

      // Single part (no hyphen): remaining from position after typedLettersIndex-th letter
      if (parts.length === 1) {
        const indices = getLetterIndices(word.text)
        const startIdx = indices[typedLettersIndex - 1] + 1
        return word.text.substring(startIdx)
      }
      
      // Hyphenated: build remaining from current part onwards
      let remainingText = ''
      for (let i = typedLettersIndex; i < parts.length; i++) {
        if (i > typedLettersIndex && separators[i - 1]) remainingText += separators[i - 1]
        remainingText += parts[i]
      }
      return remainingText
    }

    // Check if a word is partially typed (for hyphenated words like "residing—all")
    const isPartiallyTyped = (word) => {
      if (!word.requiredLetters || word.requiredLetters.length <= 1) {
        return false
      }
      const typedLettersIndex = word.typedLettersIndex || 0
      return typedLettersIndex > 0 && typedLettersIndex < word.requiredLetters.length
    }

    // Check if typed letter is correct or adjacent (fuzzy typing)
    const isLetterMatch = (typedLetter, correctLetter) => {
      const typed = typedLetter.toLowerCase()
      const correct = correctLetter.toLowerCase()
      
      // Exact match
      if (typed === correct) return true
      
      // Check if typed letter is adjacent to correct letter
      const adjacentKeys = getAdjacentKeys(correct)
      return adjacentKeys.includes(typed)
    }

    // Vibrate phone on wrong keypress
    const vibrate = (pattern = 100) => {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern)
      }
    }

    // SRS functions (calculateGrade, wasReviewedToday, calculateNextReviewDate)
    // are imported from ./srs.js

    // Check if a verse is due for review (only for mastered verses)
    const isDueForReview = (verse) => {
      if (verse.memorizationStatus !== 'mastered') return false
      if (!verse.nextReviewDate) return true
      const now = new Date()
      const nextReview = new Date(verse.nextReviewDate)
      return now >= nextReview
    }

    // Get memorization status display
    const getMemorizationStatus = (verse) => {
      return verse.memorizationStatus || 'unmemorized'
    }

    // Get next memorization mode
    const getNextMemorizationMode = (status) => {
      const progression = {
        'unmemorized': 'learn',
        'learned': 'memorize',
        'memorized': 'master',
        'mastered': null
      }
      return progression[status] || null
    }

    // Handle verse click - route to memorization or review
    const handleVerseClick = (verse) => {
      if (verse.memorizationStatus !== 'mastered') {
        // Not mastered yet - start memorization
        const nextMode = getNextMemorizationMode(verse.memorizationStatus)
        if (nextMode) {
          startMemorization(verse, nextMode)
        }
      } else {
        // Mastered - start review
        startReview(verse)
      }
    }

    const isVerseExpanded = (verse) => !!expandedVerseIds.value[verse.id]
    const toggleVerseExpanded = (verse, e) => {
      e.stopPropagation()
      const next = { ...expandedVerseIds.value }
      next[verse.id] = !next[verse.id]
      expandedVerseIds.value = next
    }

    const beforeVerseExpand = (el) => {
      el.style.height = '0'
      el.style.opacity = '0'
      el.style.transform = 'translateY(-6px)'
    }

    const enterVerseExpand = (el, done) => {
      el.style.overflow = 'hidden'
      void el.offsetHeight

      requestAnimationFrame(() => {
        el.style.height = `${el.scrollHeight}px`
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      })

      const onTransitionEnd = (event) => {
        if (event.target !== el || event.propertyName !== 'height') return
        el.removeEventListener('transitionend', onTransitionEnd)
        done()
      }

      el.addEventListener('transitionend', onTransitionEnd)
    }

    const afterVerseExpand = (el) => {
      el.style.height = 'auto'
      el.style.overflow = ''
    }

    const beforeVerseCollapse = (el) => {
      el.style.height = `${el.scrollHeight}px`
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
      el.style.overflow = 'hidden'
    }

    const leaveVerseCollapse = (el, done) => {
      void el.offsetHeight

      requestAnimationFrame(() => {
        el.style.height = '0'
        el.style.opacity = '0'
        el.style.transform = 'translateY(-6px)'
      })

      const onTransitionEnd = (event) => {
        if (event.target !== el || event.propertyName !== 'height') return
        el.removeEventListener('transitionend', onTransitionEnd)
        done()
      }

      el.addEventListener('transitionend', onTransitionEnd)
    }

    const afterVerseCollapse = (el) => {
      el.style.height = ''
      el.style.opacity = ''
      el.style.transform = ''
      el.style.overflow = ''
    }

    // Get time until review (or overdue) in a human-readable format
    const splitReference = (reference) => {
      const match = reference.match(/^(.*?)\s+(\d.*)$/)
      return match ? { book: match[1], verseRef: match[2] } : { book: reference, verseRef: '' }
    }

    const getTimeUntilReview = (verse) => {
      if (!verse.nextReviewDate) return 'Now'
      const now = new Date()
      const nextReview = new Date(verse.nextReviewDate)
      const diffTime = nextReview - now
      
      if (diffTime <= 0) return 'Due'
      
      const diffMinutes = Math.ceil(diffTime / (1000 * 60))
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60))
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffMinutes < 60) return `${diffMinutes}m`
      if (diffHours < 24) return `${diffHours}h`
      return `${diffDays}d`
    }

    // Get days until review (for sorting/display)
    const getDaysUntilReview = (verse) => {
      if (!verse.nextReviewDate) return 0
      const now = new Date()
      const nextReview = new Date(verse.nextReviewDate)
      const diffTime = nextReview - now
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    }

    // Add new verse
    const addVerse = () => {
      if (newVerse.value.reference && newVerse.value.content) {
        const now = new Date().toISOString()
        
        // If inside a collection (and not master-list), automatically add to that collection
        let collectionIds = newVerse.value.collectionIds || []
        if (currentCollectionId.value && currentCollectionId.value !== 'master-list') {
          // Ensure the current collection is included
          if (!collectionIds.includes(currentCollectionId.value)) {
            collectionIds = [...collectionIds, currentCollectionId.value]
          }
        }
        
        const verse = {
          id: Date.now().toString(),
          reference: newVerse.value.reference.trim(),
          content: newVerse.value.content.trim(),
          bibleVersion: newVerse.value.bibleVersion ? newVerse.value.bibleVersion.trim().toUpperCase() : '',
          createdAt: now,
          lastModified: now, // Track when verse was last modified
          memorizationStatus: 'unmemorized', // unmemorized, learned, memorized, mastered
          reviewCount: 0,
          lastReviewed: null,
          nextReviewDate: null, // Not in spaced repetition until mastered
          easeFactor: 2.5, // Default ease factor (SM-2 standard)
          interval: 0,
          reviewHistory: [],
          masteredAt: null,
          collectionIds: collectionIds
        }
        verses.value.unshift(verse)
        saveVerses()
        if (!onboardingDismissed.value && guidedOnboardingStep.value !== 'done' && guidedOnboardingStep.value !== 'review-tip' && guidedOnboardingStep.value !== 'review-tab') {
          setGuidedOnboardingStep('tap-verse', verse.id)
        }
        closeForm()
        scrollToOnboardingVerse()
      }
    }

    // Close form and reset
    const closeForm = () => {
      showForm.value = false
      newVerse.value = {
        reference: '',
        content: '',
        bibleVersion: '',
        collectionIds: []
      }
      fabMenuOpen.value = false
      importError.value = null
      importErrorShowLink.value = false
      importingVerse.value = false
    }

    // Initialize Bible client lazily
    const initBibleClient = async () => {
      if (!bibleClient.value) {
        bibleClient.value = new BibleClient()
      }
      if (!bibleCollection.value) {
        bibleCollection.value = await bibleClient.value.fetch_collection()
      }
      return { client: bibleClient.value, collection: bibleCollection.value }
    }

    // Parse verse reference into components
    const parseVerseReference = (reference) => {
      // Handles: "John 3:16", "John 3:16-17", "1 John 1:9", "Psalm 23:1-6"
      const match = reference.match(/^(\d?\s*[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?$/)
      if (!match) return null

      const bookName = match[1].trim()
      const chapter = parseInt(match[2], 10)
      const verseStart = parseInt(match[3], 10)
      const verseEnd = match[4] ? parseInt(match[4], 10) : verseStart

      return { bookName, chapter, verseStart, verseEnd }
    }

    // Map book name to API book ID
    const getBookId = (bookName) => {
      const normalizedName = bookName.toLowerCase().replace(/\s+/g, '')

      // Common variations mapping
      const variations = {
        'psalm': 'psa', 'psalms': 'psa', 'ps': 'psa',
        'genesis': 'gen', 'gen': 'gen',
        'exodus': 'exo', 'exod': 'exo', 'ex': 'exo',
        'leviticus': 'lev', 'lev': 'lev',
        'numbers': 'num', 'num': 'num',
        'deuteronomy': 'deu', 'deut': 'deu',
        'joshua': 'jos', 'josh': 'jos',
        'judges': 'jdg', 'judg': 'jdg',
        'ruth': 'rut',
        '1samuel': '1sa', '1sam': '1sa',
        '2samuel': '2sa', '2sam': '2sa',
        '1kings': '1ki', '1kgs': '1ki',
        '2kings': '2ki', '2kgs': '2ki',
        '1chronicles': '1ch', '1chr': '1ch',
        '2chronicles': '2ch', '2chr': '2ch',
        'ezra': 'ezr',
        'nehemiah': 'neh', 'neh': 'neh',
        'esther': 'est', 'esth': 'est',
        'job': 'job',
        'proverbs': 'pro', 'prov': 'pro',
        'ecclesiastes': 'ecc', 'eccl': 'ecc',
        'songofsolomon': 'sng', 'songofsongs': 'sng', 'song': 'sng', 'sos': 'sng',
        'isaiah': 'isa', 'isa': 'isa',
        'jeremiah': 'jer', 'jer': 'jer',
        'lamentations': 'lam', 'lam': 'lam',
        'ezekiel': 'ezk', 'ezek': 'ezk',
        'daniel': 'dan', 'dan': 'dan',
        'hosea': 'hos', 'hos': 'hos',
        'joel': 'jol', 'joe': 'jol',
        'amos': 'amo', 'amo': 'amo',
        'obadiah': 'oba', 'obad': 'oba',
        'jonah': 'jon', 'jon': 'jon',
        'micah': 'mic', 'mic': 'mic',
        'nahum': 'nam', 'nah': 'nam',
        'habakkuk': 'hab', 'hab': 'hab',
        'zephaniah': 'zep', 'zeph': 'zep',
        'haggai': 'hag', 'hag': 'hag',
        'zechariah': 'zec', 'zech': 'zec',
        'malachi': 'mal', 'mal': 'mal',
        'matthew': 'mat', 'matt': 'mat', 'mt': 'mat',
        'mark': 'mrk', 'mk': 'mrk', 'mar': 'mrk',
        'luke': 'luk', 'lk': 'luk',
        'john': 'jhn', 'jn': 'jhn',
        'acts': 'act',
        'romans': 'rom', 'rom': 'rom',
        '1corinthians': '1co', '1cor': '1co',
        '2corinthians': '2co', '2cor': '2co',
        'galatians': 'gal', 'gal': 'gal',
        'ephesians': 'eph', 'eph': 'eph',
        'philippians': 'php', 'phil': 'php',
        'colossians': 'col', 'col': 'col',
        '1thessalonians': '1th', '1thess': '1th',
        '2thessalonians': '2th', '2thess': '2th',
        '1timothy': '1ti', '1tim': '1ti',
        '2timothy': '2ti', '2tim': '2ti',
        'titus': 'tit', 'tit': 'tit',
        'philemon': 'phm', 'phlm': 'phm',
        'hebrews': 'heb', 'heb': 'heb',
        'james': 'jas', 'jam': 'jas',
        '1peter': '1pe', '1pet': '1pe',
        '2peter': '2pe', '2pet': '2pe',
        '1john': '1jn', '1jn': '1jn',
        '2john': '2jn', '2jn': '2jn',
        '3john': '3jn', '3jn': '3jn',
        'jude': 'jud',
        'revelation': 'rev', 'rev': 'rev'
      }

      // Try direct variation match
      if (variations[normalizedName]) {
        return variations[normalizedName]
      }

      // Try first 3 characters as fallback
      return normalizedName.substring(0, 3)
    }

    // Main import function
    const importVerseContent = async () => {
      importError.value = null
      importErrorShowLink.value = false

      const reference = newVerse.value.reference.trim()
      const version = newVerse.value.bibleVersion.trim().toLowerCase()

      if (!reference || !version) {
        importError.value = 'Please enter both a verse reference and Bible version first.'
        return
      }

      const parsed = parseVerseReference(reference)
      if (!parsed) {
        importError.value = "Could not parse verse reference. Please use format like 'John 3:16' or 'John 3:16-17'."
        return
      }

      importingVerse.value = true

      try {
        const { collection } = await initBibleClient()

        // Try to find the translation with different ID formats
        // Users might enter "BSB", but the API uses "eng_bsb"
        const versionVariants = [
          version,
          `eng_${version}`,
          version.replace(/^eng_/, ''),
        ]

        let translationId = null
        for (const variant of versionVariants) {
          if (collection.has_translation(variant)) {
            translationId = variant
            break
          }
        }

        if (!translationId) {
          importError.value = `The ${version.toUpperCase()} version is not available. Most popular translations (ESV, NIV, NASB, etc.) are copyrighted and not freely distributable.`
          importErrorShowLink.value = true
          importingVerse.value = false
          return
        }

        // Get the book ID
        const bookId = getBookId(parsed.bookName)

        // Check if book exists in this translation
        if (!collection.has_book(translationId, bookId)) {
          importError.value = `Could not find book '${parsed.bookName}' in this translation.`
          importingVerse.value = false
          return
        }

        // Fetch the book in 'txt' format which supports excluding notes
        const book = await collection.fetch_book(translationId, bookId, 'txt')

        // Extract verses using get_passage for ranges or get_verse for single
        // Use notes: false to exclude footnotes, verse_nums: false to exclude verse numbers
        const options = { attribute: false, notes: false, verse_nums: false, headings: false }
        let verseText
        if (parsed.verseStart === parsed.verseEnd) {
          verseText = book.get_verse(parsed.chapter, parsed.verseStart, options)
        } else {
          verseText = book.get_passage(
            parsed.chapter, parsed.verseStart,
            parsed.chapter, parsed.verseEnd,
            options
          )
        }

        if (!verseText) {
          importError.value = 'Verse(s) not found. Please check the chapter and verse numbers.'
          importingVerse.value = false
          return
        }

        // Clean up whitespace
        verseText = verseText.replace(/\s+/g, ' ').trim()

        if (!verseText) {
          importError.value = 'Verse(s) not found. Please check the verse numbers.'
          importingVerse.value = false
          return
        }

        newVerse.value.content = verseText
        importingVerse.value = false

      } catch (err) {
        console.error('Import error:', err)
        importError.value = `Failed to import verse: ${err.message}`
        importingVerse.value = false
      }
    }

    // Add new collection
    const addCollection = () => {
      if (newCollection.value.name.trim()) {
        const collection = {
          id: Date.now().toString(),
          name: newCollection.value.name.trim(),
          description: newCollection.value.description.trim(),
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString() // Track when collection was last modified
        }
        collections.value.push(collection)
        saveCollections()
        closeCollectionForm()
      }
    }

    // Close collection form
    const closeCollectionForm = () => {
      showCollectionForm.value = false
      newCollection.value = {
        name: '',
        description: ''
      }
      fabMenuOpen.value = false
    }

    // Handle FAB click
    const handleFabClick = () => {
      // Toggle menu for both collections screen and inside collections
      fabMenuOpen.value = !fabMenuOpen.value
    }

    // Open new verse from FAB menu
    const openNewVerse = () => {
      fabMenuOpen.value = false
      showForm.value = true
    }

    // Open new collection from FAB menu
    const openNewCollection = () => {
      fabMenuOpen.value = false
      showCollectionForm.value = true
    }

    // Open CSV import modal
    const openImportCSV = () => {
      fabMenuOpen.value = false
      csvImportFromCollectionsScreen.value = !currentCollectionId.value && currentView.value === 'collections'
      csvImportTargetCollectionIds.value = csvImportFromCollectionsScreen.value ? [] : []
      showImportCSV.value = true
      csvPreview.value = []
      csvImportStatus.value = null
      csvPastedText.value = ''
    }

    // Close CSV import modal
    const closeImportCSV = () => {
      showImportCSV.value = false
      csvPreview.value = []
      csvImportStatus.value = null
      csvPastedText.value = ''
      csvImportTargetCollectionIds.value = []
      if (csvFileInput.value) {
        csvFileInput.value.value = ''
      }
    }

    // Parse CSV file
    const parseCSV = (text) => {
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length === 0) return []
      
      // Parse header row
      const headerLine = lines[0]
      const headers = parseCSVLine(headerLine)
      
      // Normalize header names (case-insensitive, trim whitespace)
      const normalizedHeaders = headers.map(h => h.trim().toLowerCase())
      const referenceIndex = normalizedHeaders.findIndex(h => h === 'reference')
      const contentIndex = normalizedHeaders.findIndex(h => h === 'content')
      const versionIndex = normalizedHeaders.findIndex(h => h === 'version')
      const daysUntilNextReviewIndex = normalizedHeaders.findIndex(h => 
        h === 'daysuntilnextreview' || h === 'daysuntilreview' || h === 'days_until_next_review' || h === 'days_until_review'
      )
      const intervalIndex = normalizedHeaders.findIndex(h => h === 'interval')
      
      if (referenceIndex === -1 || contentIndex === -1) {
        throw new Error('CSV must have "Reference" and "Content" columns')
      }
      
      // Parse data rows
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        if (values.length === 0) continue
        
        const row = {
          reference: values[referenceIndex]?.trim() || '',
          content: values[contentIndex]?.trim() || '',
          version: versionIndex !== -1 ? (values[versionIndex]?.trim() || '') : '',
          daysUntilNextReview: daysUntilNextReviewIndex !== -1 ? (values[daysUntilNextReviewIndex]?.trim() || '') : '',
          interval: intervalIndex !== -1 ? (values[intervalIndex]?.trim() || '') : ''
        }
        
        // Only add rows with reference and content
        if (row.reference && row.content) {
          rows.push(row)
        }
      }
      
      return rows
    }

    // Parse a single CSV line, handling quoted fields
    const parseCSVLine = (line) => {
      const result = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]
        
        if (char === '\\' && inQuotes) {
          // Handle backslash escape sequences within quoted fields
          if (nextChar === '"') {
            // Escaped quote: \"
            current += '"'
            i++ // Skip the quote
          } else if (nextChar === '\\') {
            // Escaped backslash: \\
            current += '\\'
            i++ // Skip the next backslash
          } else if (nextChar === 'n') {
            // Escaped newline: \n
            current += '\n'
            i++ // Skip the 'n'
          } else if (nextChar === 't') {
            // Escaped tab: \t
            current += '\t'
            i++ // Skip the 't'
          } else if (nextChar === 'r') {
            // Escaped carriage return: \r
            current += '\r'
            i++ // Skip the 'r'
          } else {
            // Unknown escape sequence, keep the backslash
            current += char
          }
        } else if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Standard CSV escaped quote (e.g., "")
            current += '"'
            i++ // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          result.push(current)
          current = ''
        } else {
          current += char
        }
      }
      
      // Add last field
      result.push(current)
      return result
    }

    // Handle CSV file selection
    const handleCSVFileSelect = (event) => {
      const file = event.target.files[0]
      if (!file) return
      
      // Clear textarea if file is selected
      csvPastedText.value = ''
      
      csvImportStatus.value = null
      csvPreview.value = []
      
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target.result
          const parsed = parseCSV(text)
          
          if (parsed.length === 0) {
            csvImportStatus.value = {
              type: 'error',
              message: 'No valid verses found in CSV file. Make sure the file has "Reference" and "Content" columns.'
            }
            return
          }
          
          csvPreview.value = parsed
          // Don't set success status here - just show preview. Status will be set after import.
        } catch (error) {
          csvImportStatus.value = {
            type: 'error',
            message: `Error parsing CSV: ${error.message}`
          }
          csvPreview.value = []
        }
      }
      
      reader.onerror = () => {
        csvImportStatus.value = {
          type: 'error',
          message: 'Error reading file. Please try again.'
        }
      }
      
      reader.readAsText(file)
    }

    // Handle CSV paste from textarea
    const handleCSVPaste = () => {
      const text = csvPastedText.value
      
      // Clear file input if text is pasted
      if (text.trim() && csvFileInput.value) {
        csvFileInput.value.value = ''
      }
      
      csvImportStatus.value = null
      csvPreview.value = []
      
      if (!text.trim()) {
        return
      }
      
      try {
        const parsed = parseCSV(text)
        
        if (parsed.length === 0) {
          csvImportStatus.value = {
            type: 'error',
            message: 'No valid verses found in CSV content. Make sure the content has "Reference" and "Content" columns.'
          }
          return
        }
        
        csvPreview.value = parsed
        // Don't set success status here - just show preview. Status will be set after import.
      } catch (error) {
        csvImportStatus.value = {
          type: 'error',
          message: `Error parsing CSV: ${error.message}`
        }
        csvPreview.value = []
      }
    }

    // Estimate review count based on interval (heuristic)
    const estimateReviewCount = (interval) => {
      if (!interval || interval <= 0) return 0
      if (interval >= 60) return 10  // Mature verses with long intervals
      if (interval >= 30) return 5
      if (interval >= 7) return 3
      if (interval > 0) return 1
      return 0
    }

    // Parse and validate numeric field from CSV
    const parseNumericField = (value, fieldName, min = 0, max = null) => {
      if (!value || value.trim() === '') return null
      const num = parseFloat(value.trim())
      if (isNaN(num)) {
        throw new Error(`Invalid ${fieldName}: "${value}" is not a number`)
      }
      if (num < min) {
        throw new Error(`Invalid ${fieldName}: ${num} is less than minimum ${min}`)
      }
      if (max !== null && num > max) {
        throw new Error(`Invalid ${fieldName}: ${num} is greater than maximum ${max}`)
      }
      return num
    }

    // Import verses from CSV
    const importCSVVerses = () => {
      if (csvPreview.value.length === 0) return
      
      importingCSV.value = true
      csvImportStatus.value = null
      
      try {
        const now = new Date().toISOString()
        let importedCount = 0
        let updatedCount = 0
        let importedWithProgressCount = 0
        let updatedWithProgressCount = 0
        
        // Determine collection IDs to add verses to
        let collectionIds = []
        if (csvImportFromCollectionsScreen.value) {
          collectionIds = [...(csvImportTargetCollectionIds.value || [])]
        } else if (currentCollectionId.value && currentCollectionId.value !== 'master-list') {
          collectionIds = [currentCollectionId.value]
        }
        
        csvPreview.value.forEach(row => {
          // Parse and validate interval and days until review
          let interval = null
          let daysUntilNextReview = null
          
          try {
            interval = parseNumericField(row.interval, 'Interval', 0, 365)
            daysUntilNextReview = parseNumericField(row.daysUntilNextReview, 'DaysUntilNextReview', 0, 365)
          } catch (error) {
            throw new Error(`Error in row "${row.reference}": ${error.message}`)
          }
          
          // Check if verse already exists (by reference)
          const existingVerse = verses.value.find(v => 
            v.reference.toLowerCase().trim() === row.reference.toLowerCase().trim()
          )
          
          if (existingVerse) {
            // Update existing verse with memorization data
            let hasProgressUpdate = false
            let hasAnyUpdate = false
            
            // Update version if provided
            if (row.version && row.version.trim()) {
              existingVerse.bibleVersion = row.version.trim().toUpperCase()
              hasAnyUpdate = true
            }
            
            // Update memorization fields if provided
            if (interval !== null && interval > 0) {
              existingVerse.memorizationStatus = 'mastered'
              existingVerse.interval = interval
              
              // Estimate review count if not already set or if interval suggests more reviews
              const estimatedCount = estimateReviewCount(interval)
              if (!existingVerse.reviewCount || existingVerse.reviewCount < estimatedCount) {
                existingVerse.reviewCount = estimatedCount
              }
              
              hasProgressUpdate = true
              hasAnyUpdate = true
            }
            
            // Update next review date
            if (daysUntilNextReview !== null) {
              const nextDate = new Date()
              nextDate.setDate(nextDate.getDate() + daysUntilNextReview)
              existingVerse.nextReviewDate = nextDate.toISOString()
              
              // If we have a next review date and interval, set last reviewed date
              if (interval !== null && interval > 0 && !existingVerse.lastReviewed) {
                const lastReviewDate = new Date(nextDate)
                lastReviewDate.setDate(lastReviewDate.getDate() - interval)
                existingVerse.lastReviewed = lastReviewDate.toISOString()
              }
              
              hasProgressUpdate = true
              hasAnyUpdate = true
            } else if (interval !== null && interval > 0 && !existingVerse.nextReviewDate) {
              // If interval provided but no days until review, set next review to now (due immediately)
              existingVerse.nextReviewDate = now
              hasAnyUpdate = true
            }
            
            // Update ease factor if we're setting up a mastered verse
            if (interval !== null && interval > 0 && existingVerse.easeFactor === 2.5) {
              // Keep default ease factor for now, or could calculate based on interval
              existingVerse.easeFactor = 2.5
            }
            
            // If importing into collection(s), add to those collections if not already there
            const targetCollectionIds = csvImportFromCollectionsScreen.value
              ? (csvImportTargetCollectionIds.value || [])
              : (currentCollectionId.value && currentCollectionId.value !== 'master-list' ? [currentCollectionId.value] : [])
            for (const cid of targetCollectionIds) {
              if (!existingVerse.collectionIds) {
                existingVerse.collectionIds = []
              }
              if (!existingVerse.collectionIds.includes(cid)) {
                existingVerse.collectionIds.push(cid)
                hasAnyUpdate = true
              }
            }
            
            // Update lastModified timestamp whenever verse is modified
            if (hasAnyUpdate) {
              existingVerse.lastModified = now
            }
            
            if (hasProgressUpdate) {
              updatedWithProgressCount++
            }
            updatedCount++
            return
          }
          
          // Create new verse
          let memorizationStatus = 'unmemorized'
          let reviewCount = 0
          let nextReviewDate = null
          let lastReviewed = null
          let verseInterval = 0
          let hasProgress = false
          
          // Set up memorization data if provided
          if (interval !== null && interval > 0) {
            memorizationStatus = 'mastered'
            verseInterval = interval
            reviewCount = estimateReviewCount(interval)
            hasProgress = true
            
            // Set next review date
            if (daysUntilNextReview !== null) {
              const nextDate = new Date()
              nextDate.setDate(nextDate.getDate() + daysUntilNextReview)
              nextReviewDate = nextDate.toISOString()
              
              // Estimate last reviewed date
              const lastReviewDate = new Date(nextDate)
              lastReviewDate.setDate(lastReviewDate.getDate() - interval)
              lastReviewed = lastReviewDate.toISOString()
            } else {
              // If interval provided but no days until review, set next review to now
              nextReviewDate = now
            }
          }
          
          const verse = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            reference: row.reference.trim(),
            content: row.content.trim(),
            bibleVersion: row.version ? row.version.trim().toUpperCase() : '',
            createdAt: now,
            lastModified: now, // Track when verse was last modified
            memorizationStatus: memorizationStatus,
            reviewCount: reviewCount,
            lastReviewed: lastReviewed,
            nextReviewDate: nextReviewDate,
            easeFactor: 2.5,
            interval: verseInterval,
            reviewHistory: [],
            collectionIds: collectionIds
          }
          
          verses.value.unshift(verse)
          importedCount++
          if (hasProgress) {
            importedWithProgressCount++
          }
        })
        
        saveVerses()
        
        // Build status message
        let statusMessage = `Successfully imported ${importedCount} verse${importedCount !== 1 ? 's' : ''}`
        if (importedWithProgressCount > 0) {
          statusMessage += ` (${importedWithProgressCount} with memorization progress)`
        }
        if (updatedCount > 0) {
          statusMessage += `. Updated ${updatedCount} existing verse${updatedCount !== 1 ? 's' : ''}`
          if (updatedWithProgressCount > 0) {
            statusMessage += ` (${updatedWithProgressCount} with memorization progress)`
          }
        }
        
        csvImportStatus.value = {
          type: 'success',
          message: statusMessage
        }
        
        // Clear preview after successful import
        setTimeout(() => {
          csvPreview.value = []
          csvImportStatus.value = null
          csvPastedText.value = ''
          if (csvFileInput.value) {
            csvFileInput.value.value = ''
          }
        }, 3000)
      } catch (error) {
        csvImportStatus.value = {
          type: 'error',
          message: `Error importing verses: ${error.message}`
        }
      } finally {
        importingCSV.value = false
      }
    }

    // Edit collection
    const startEditCollection = (collection) => {
      editingCollection.value = {
        ...collection
      }
      showEditCollectionForm.value = true
    }

    // Save edited collection
    const saveEditedCollection = () => {
      if (editingCollection.value && editingCollection.value.name) {
        const collection = collections.value.find(c => c.id === editingCollection.value.id)
        if (collection) {
          collection.name = editingCollection.value.name.trim()
          collection.description = editingCollection.value.description ? editingCollection.value.description.trim() : ''
          collection.lastModified = new Date().toISOString() // Track when collection was last modified
          saveCollections()
          closeEditCollectionForm()
        }
      }
    }

    // Close edit collection form
    const closeEditCollectionForm = () => {
      showEditCollectionForm.value = false
      editingCollection.value = null
    }

    // Handle delete collection from edit modal
    const handleDeleteCollectionFromModal = () => {
      if (editingCollection.value && deleteCollection(editingCollection.value.id)) {
        closeEditCollectionForm()
      }
    }

    // Delete collection
    const deleteCollection = (collectionId) => {
      if (confirm('Are you sure you want to delete this collection? Verses will not be deleted, but will be removed from this collection.')) {
        // Mark as deleted for sync FIRST (before removing from array)
        markCollectionDeleted(collectionId)
        
        // Verify deletion was saved
        const deletedAfterMark = getDeletedCollections()
        console.log('[App] Collection deleted, deletion list:', deletedAfterMark, 'should include:', collectionId)
        
        // Remove collection from all verses
        verses.value.forEach(verse => {
          if (verse.collectionIds) {
            verse.collectionIds = verse.collectionIds.filter(id => id !== collectionId)
          }
        })
        saveVerses()
        
        // Remove collection
        collections.value = collections.value.filter(c => c.id !== collectionId)
        saveCollections()
        
        // If viewing this collection, go back to all verses
        if (currentCollectionId.value === collectionId) {
          currentCollectionId.value = null
        }
        return true
      }
      return false
    }

    // Get verses for current view (all or filtered by collection)
    const getVersesForView = () => {
      if (currentCollectionId.value) {
        // Handle special "master-list" collection
        if (currentCollectionId.value === 'master-list') {
          return verses.value
        }
        // Handle "no-collection" - verses that don't belong to any collection
        if (currentCollectionId.value === 'no-collection') {
          return verses.value.filter(v => {
            const ids = v.collectionIds
            return !ids || (Array.isArray(ids) && ids.length === 0)
          })
        }
        // Handle "to-learn" - verses that are not yet mastered
        if (currentCollectionId.value === 'to-learn') {
          return verses.value.filter(v => v.memorizationStatus !== 'mastered')
        }
        return verses.value.filter(v => v.collectionIds && v.collectionIds.includes(currentCollectionId.value))
      }
      // No collection selected: show all verses when on Verses tab with no user collections
      if (currentView.value === 'collections' && collections.value.length === 0) {
        return verses.value
      }
      return []
    }

    // Get collection name by ID
    const getCollectionName = (collectionId) => {
      if (collectionId === 'master-list') {
        return 'All Verses'
      }
      if (collectionId === 'no-collection') {
        return 'Uncategorized'
      }
      if (collectionId === 'to-learn') {
        return 'Not Yet Mastered'
      }
      const collection = collections.value.find(c => c.id === collectionId)
      return collection ? collection.name : 'Unknown'
    }

    // countVersesInReference imported from ./utils/verse-count.js

    // Get verse count for a collection (accounts for verse ranges)
    const getCollectionVerseCount = (collectionId) => {
      let collectionVerses
      if (collectionId === 'master-list') {
        collectionVerses = verses.value
      } else if (collectionId === 'no-collection') {
        collectionVerses = verses.value.filter(v => {
          const ids = v.collectionIds
          return !ids || (Array.isArray(ids) && ids.length === 0)
        })
      } else if (collectionId === 'to-learn') {
        collectionVerses = verses.value.filter(v => v.memorizationStatus !== 'mastered')
      } else {
        collectionVerses = verses.value.filter(v => v.collectionIds && v.collectionIds.includes(collectionId))
      }
      return sumVerseReferenceCounts(collectionVerses)
    }

    // Get count of verses due for review in a collection
    const getCollectionDueCount = (collectionId) => {
      let collectionVerses
      if (collectionId === 'master-list') {
        collectionVerses = verses.value
      } else if (collectionId === 'no-collection') {
        collectionVerses = verses.value.filter(v => {
          const ids = v.collectionIds
          return !ids || (Array.isArray(ids) && ids.length === 0)
        })
      } else if (collectionId === 'to-learn') {
        collectionVerses = verses.value.filter(v => v.memorizationStatus !== 'mastered')
      } else {
        collectionVerses = verses.value.filter(v => v.collectionIds && v.collectionIds.includes(collectionId))
      }
      return collectionVerses.filter(v => isDueForReview(v)).length
    }

    // Edit verse
    const startEditVerse = (verse) => {
      editingVerse.value = {
        ...verse,
        collectionIds: verse.collectionIds ? [...verse.collectionIds] : []
      }
      showEditVerseForm.value = true
    }

    // Save edited verse
    const saveEditedVerse = () => {
      if (editingVerse.value && editingVerse.value.reference && editingVerse.value.content) {
        const verse = verses.value.find(v => v.id === editingVerse.value.id)
        if (verse) {
          verse.reference = editingVerse.value.reference.trim()
          verse.content = editingVerse.value.content.trim()
          verse.bibleVersion = editingVerse.value.bibleVersion ? editingVerse.value.bibleVersion.trim().toUpperCase() : ''
          verse.collectionIds = editingVerse.value.collectionIds || []
          verse.lastModified = new Date().toISOString() // Track when verse was last modified
          saveVerses()
          closeEditVerseForm()
        }
      }
    }

    // Close edit verse form
    const closeEditVerseForm = () => {
      showEditVerseForm.value = false
      editingVerse.value = null
    }

    // Handle delete verse from edit modal
    const handleDeleteVerseFromModal = () => {
      if (editingVerse.value && deleteVerse(editingVerse.value.id)) {
        closeEditVerseForm()
      }
    }

    // Delete verse
    const deleteVerse = (verseId) => {
      if (confirm('Are you sure you want to delete this verse?')) {
        // Mark as deleted for sync
        markVerseDeleted(verseId)
        
        verses.value = verses.value.filter(v => v.id !== verseId)
        saveVerses()
        return true
      }
      return false
    }

    // View collection
    const viewCollection = (collectionId) => {
      currentCollectionId.value = collectionId
      pushNavigationState({ view: 'collection', collectionId })
    }

    // Navigate to review list view
    const navigateToReviewList = () => {
      currentCollectionId.value = null
      currentView.value = 'review-list'
      searchQuery.value = ''
      searchActive.value = false
      if (guidedOnboardingStep.value === 'review-tab') {
        setGuidedOnboardingStep('review-tip', guidedOnboardingVerseId.value)
      }
      pushNavigationState({ view: 'review-list' })
    }

    // Navigate to collections view
    const navigateToCollections = () => {
      currentCollectionId.value = null
      currentView.value = 'collections'
      pushNavigationState({ view: 'collections' })
    }

    // Navigate to stats view
    const navigateToStats = () => {
      currentCollectionId.value = null
      currentView.value = 'stats'
      searchQuery.value = ''
      searchActive.value = false
      pushNavigationState({ view: 'stats' })
    }

    const clearSearch = () => {
      searchQuery.value = ''
      searchActive.value = false
    }

    const openSearch = () => {
      searchActive.value = true
      pushNavigationState({ view: 'search' })
      nextTick(() => {
        searchInputRef.value?.focus()
      })
    }

    // Highlight matching text in search results
    const highlightText = (text, matches, fieldName) => {
      if (!matches || matches.length === 0) {
        return escapeHtml(text)
      }
      
      // Find matches for this specific field
      const fieldMatch = matches.find(m => m.key === fieldName)
      if (!fieldMatch || !fieldMatch.indices || fieldMatch.indices.length === 0) {
        return escapeHtml(text)
      }
      
      // Sort indices by start position (descending) to avoid index shifting issues
      const sortedIndices = [...fieldMatch.indices].sort((a, b) => b[0] - a[0])
      
      let highlightedText = text
      sortedIndices.forEach(([start, end]) => {
        const before = highlightedText.substring(0, start)
        const match = highlightedText.substring(start, end + 1)
        const after = highlightedText.substring(end + 1)
        highlightedText = before + '<mark class="bg-highlight">' + escapeHtml(match) + '</mark>' + after
      })
      
      return highlightedText
    }

    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }

    const speakVerse = (verse) => {
      window.speechSynthesis.cancel()
      const verseObj = verse?.value || verse
      if (!verseObj?.content || !verseObj?.reference) return
      const utterance = new SpeechSynthesisUtterance(`${verseObj.reference}. ${verseObj.content}`)
      utterance.onend = () => { isSpeaking.value = false }
      utterance.onerror = () => { isSpeaking.value = false }
      isSpeaking.value = true
      window.speechSynthesis.speak(utterance)
    }

    const stopSpeaking = () => {
      window.speechSynthesis.cancel()
      isSpeaking.value = false
    }

    // Copy verse to clipboard in the format: content\nreference
    const copyVerse = async (verse) => {
      // Handle Vue refs - if verse is a ref, get its value
      let verseObj = verse
      if (verse && typeof verse === 'object' && 'value' !== undefined && Object.prototype.hasOwnProperty.call(verse, 'value')) {
        verseObj = verse.value
      }
      
      if (!verseObj || !verseObj.content || !verseObj.reference) {
        console.error('No verse provided to copyVerse', verse, verseObj)
        showToast('Error: No verse to copy', true)
        return
      }
      
      const textToCopy = `${verseObj.content}\n${verseObj.reference}`
      
      try {
        await navigator.clipboard.writeText(textToCopy)
        showToast('Verse copied to clipboard')
      } catch (err) {
        console.error('Failed to copy verse:', err)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = textToCopy
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          showToast('Verse copied to clipboard')
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr)
          showToast('Failed to copy verse', true)
        }
        document.body.removeChild(textArea)
      }
    }

    // Show transient toast feedback for copy/sync actions.
    const showToast = (message, isError = false) => {
      if (toastTimeoutId) {
        clearTimeout(toastTimeoutId)
      }

      toastState.value = { show: true, message, isError }
      toastTimeoutId = setTimeout(() => {
        toastState.value.show = false
        toastTimeoutId = null
      }, 2000)
    }

    // View all verses (back from collection view)
    const viewAllVerses = () => {
      currentCollectionId.value = null
      searchQuery.value = ''
      searchActive.value = false
      // Keep current view (review-list or collections)
      pushNavigationState({ view: currentView.value })
    }

    // Check if we can switch to a given memorization mode
    const canSwitchToMode = (targetMode) => {
      if (!memorizingVerse.value || !memorizationMode.value) return false
      
      // Can switch to any mode when actively memorizing
      // This allows free navigation between learn, memorize, and master modes
      return true
    }

    // Switch to a different memorization mode
    const switchToMemorizationMode = (mode) => {
      if (!memorizingVerse.value) return
      if (!canSwitchToMode(mode)) return

      if (mode !== memorizationMode.value) {
        dismissPracticeModesHint()
      }
      startMemorization(memorizingVerse.value, mode)
    }

    // Start memorizing a verse
    const startMemorization = (verse, mode) => {
      if (
        (guidedOnboardingStep.value === 'tap-verse' || guidedOnboardingStep.value === 'practice') &&
        verse.id === guidedOnboardingVerseId.value
      ) {
        setGuidedOnboardingStep('practice', verse.id)
      }

      memorizingVerse.value = verse
      memorizationMode.value = mode
      reviewMistakes.value = 0
      if (mode === 'memorize') memorizeRetryCount.value += 1 // Alternate pattern each time

      // Track whether we're already in a session before potentially setting the source state
      const alreadyInSession = !!memorizationSourceState.value

      // Store the source state for navigation (only if not already set, to preserve it during mode advancement)
      if (!memorizationSourceState.value) {
        if (currentCollectionId.value) {
          // Coming from a collection - store collection state
          memorizationSourceState.value = {
            view: 'collection',
            collectionId: currentCollectionId.value
          }
        } else if (currentView.value === 'review-list') {
          // Coming from review list - store review list state
          memorizationSourceState.value = {
            view: 'review-list'
          }
        } else if (currentView.value === 'collections') {
          // Coming from collections view - store collections state
          memorizationSourceState.value = {
            view: 'collections'
          }
        }
      }
      
      resetPracticeSequence(verse, mode, memorizeRetryCount.value)
      
      // Push navigation state (replace if already in a memorization session to avoid back-stepping through modes)
      const navState = {
        view: 'memorization',
        verseId: verse.id,
        mode: mode,
        collectionId: currentCollectionId.value
      }
      if (alreadyInSession) {
        replaceNavigationState(navState)
      } else {
        pushNavigationState(navState)
      }
      
      // Focus input after DOM update
      nextTick(() => {
        memorizationPracticeRef.value?.focusInput?.()
      })
    }

    // For review context, all mode buttons are clickable (verse is always mastered)
    const canSwitchToModeForReview = () => true

    // Switch mode while on review screen (rebuild words, reset state)
    const switchReviewMode = (mode) => {
      if (!reviewingVerse.value) return
      if (mode !== memorizationMode.value) {
        dismissPracticeModesHint()
      }
      if (mode === 'memorize') reviewMemorizeRetryCount.value += 1
      const verse = reviewingVerse.value
      resetPracticeSequence(verse, mode, reviewMemorizeRetryCount.value)
      memorizationMode.value = mode
      reviewMistakes.value = 0
      nextTick(() => {
        reviewPracticeRef.value?.focusInput?.()
      })
    }

    // Start reviewing a verse (only for mastered verses)
    const startReview = (verse) => {
      if (
        (guidedOnboardingStep.value === 'tap-verse' || guidedOnboardingStep.value === 'practice') &&
        verse.id === guidedOnboardingVerseId.value
      ) {
        setGuidedOnboardingStep('practice', verse.id)
      }

      if (verse.memorizationStatus !== 'mastered') {
        // If not mastered, start memorization instead
        const nextMode = getNextMemorizationMode(verse.memorizationStatus)
        if (nextMode) {
          startMemorization(verse, nextMode)
        }
        return
      }
      
      // IMPORTANT: Before starting a new review, ensure any previous review was saved (only counts when in master mode)
      // The allWordsRevealed watcher handles SRS save on first attempt, so this is a fallback safety net.
      if (reviewingVerse.value && !currentReviewSaved.value && allWordsRevealed.value && memorizationMode.value === 'master') {
        console.log('[startReview] Saving previous review before starting new one (fallback)')
        const prevVerse = verses.value.find(v => v.id === reviewingVerse.value.id)
        if (prevVerse) {
          const totalWords = totalPracticeUnitCount.value
          const grade = firstAttemptGrade.value !== null ? firstAttemptGrade.value : calculateGrade(totalWords, reviewMistakes.value)
          const mistakes = firstAttemptMistakes.value !== null ? firstAttemptMistakes.value : reviewMistakes.value

          // Check if verse was already reviewed today
          const wasAlreadyReviewedToday = wasReviewedToday(prevVerse)

          // Only advance the spaced repetition schedule on the first review of the day
          if (!wasAlreadyReviewedToday) {
            const reviewData = calculateNextReviewDate(prevVerse, grade, true)
            prevVerse.reviewCount = (prevVerse.reviewCount || 0) + 1
            prevVerse.nextReviewDate = reviewData.nextReviewDate
            prevVerse.easeFactor = reviewData.easeFactor
            prevVerse.interval = reviewData.interval
          }

          // Always update tracking fields regardless of whether it was reviewed today
          const firstAttemptAccuracy = ((totalWords - mistakes) / totalWords * 100).toFixed(1)
          prevVerse.lastReviewed = new Date().toISOString()
          prevVerse.lastGrade = grade
          prevVerse.lastAccuracy = firstAttemptAccuracy
          prevVerse.lastModified = new Date().toISOString()

          if (!prevVerse.reviewHistory) prevVerse.reviewHistory = []
          prevVerse.reviewHistory.push({
            date: new Date().toISOString(),
            grade: grade,
            accuracy: parseFloat(firstAttemptAccuracy),
            mistakes: mistakes
          })

          currentReviewSaved.value = true
          saveVerses()
          console.log('[startReview] Previous review saved', { lastReviewed: prevVerse.lastReviewed })
        }
      }
      
      reviewingVerse.value = verse
      reviewInstanceKey.value = 0 // Fresh instance so key is verseId-0 (retry bumps this to force remount)
      reviewMistakes.value = 0 // Reset mistake counter
      currentReviewSaved.value = false // Reset saved flag for new review
      firstAttemptGrade.value = null // Reset first-attempt tracking for new review
      firstAttemptMistakes.value = null
      
      // Store the source list and state for navigation (only if not already set, to preserve it during sequential navigation)
      const isSequentialNavigation = !!reviewSourceList.value
      
      if (!reviewSourceList.value) {
        // Store the original source state
        if (currentCollectionId.value) {
          // Coming from a collection - store sorted collection verses (what user sees)
          reviewSourceList.value = sortedVerses.value
          reviewSourceState.value = {
            view: 'collection',
            collectionId: currentCollectionId.value
          }
        } else if (currentView.value === 'review-list') {
          // Coming from review list - store review list verses (what user sees)
          reviewSourceList.value = reviewSortedVerses.value
          reviewSourceState.value = {
            view: 'review-list'
          }
        } else {
          // Fallback: no specific source
          reviewSourceList.value = null
          reviewSourceState.value = null
        }
      }
      
      // Push or replace navigation state
      const navigationState = {
        view: 'review',
        verseId: verse.id,
        collectionId: currentCollectionId.value
      }
      
      if (isSequentialNavigation) {
        // Replace state when navigating sequentially (from nextVerse)
        replaceNavigationState(navigationState)
      } else {
        // Push state when starting a new review session
        pushNavigationState(navigationState)
      }
      // Review always starts in master mode; build words with visible/index like startMemorization
      memorizationMode.value = 'master'
      resetPracticeSequence(verse, 'master')
      // VersePracticeView is keyed by verse id (+ reviewInstanceKey on retry), so it remounts
      // and onMounted runs the 100ms focus — that's what shows the keyboard on Android PWA.
    }

    // Advance to next memorization mode
    const advanceToNextMode = () => {
      if (!memorizingVerse.value || !allWordsRevealed.value) return
      
      // Require 90% accuracy to advance
      if (!meetsAccuracyRequirement.value) return

      markCurrentPracticeModeHintSeen()
      
      const verse = verses.value.find(v => v.id === memorizingVerse.value.id)
      if (verse) {
        const currentStatus = verse.memorizationStatus || 'unmemorized'
        let newStatus = currentStatus
        
        // Progress through memorization stages based on the mode just completed
        // This allows skipping ahead - if you complete a mode, you advance to that stage
        const statusOrder = { 'unmemorized': 0, 'learned': 1, 'memorized': 2, 'mastered': 3 }
        const currentOrder = statusOrder[currentStatus] || 0
        
        if (memorizationMode.value === 'learn') {
          // Completing learn mode sets status to at least 'learned'
          if (currentOrder < 1) {
            newStatus = 'learned'
          }
        } else if (memorizationMode.value === 'memorize') {
          // Completing memorize mode sets status to at least 'memorized'
          if (currentOrder < 2) {
            newStatus = 'memorized'
          }
        } else if (memorizationMode.value === 'master') {
          // Completing master mode sets status to 'mastered'
          newStatus = 'mastered'
          // Initialize spaced repetition fields when mastering
          if (!verse.nextReviewDate) {
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            verse.nextReviewDate = tomorrow.toISOString()
          }
          if (verse.reviewCount === undefined || verse.reviewCount === null) {
            verse.reviewCount = 0
          }
          if (!verse.easeFactor) {
            verse.easeFactor = 2.5
          }
          if (verse.interval === undefined || verse.interval === null) {
            verse.interval = 0
          }
          if (!verse.reviewHistory) {
            verse.reviewHistory = []
          }
        }
        
        verse.memorizationStatus = newStatus
        verse.lastModified = new Date().toISOString() // Track when verse was last modified
        saveVerses()
        
        // Start next mode
        const nextMode = getNextMemorizationMode(newStatus)
        if (nextMode) {
          startMemorization(verse, nextMode)
        } else {
          // If no next mode, exit
          exitMemorization()
        }
      }
    }

    // Exit memorization mode
    const exitMemorization = () => {
      stopSpeaking()
      // Update memorization status if all words were revealed and accuracy requirement is met
      if (memorizingVerse.value && allWordsRevealed.value && meetsAccuracyRequirement.value) {
        const verse = verses.value.find(v => v.id === memorizingVerse.value.id)
        if (verse) {
          const currentStatus = verse.memorizationStatus || 'unmemorized'
          
          // If completing master mode, mark as mastered and initialize spaced repetition
          if (memorizationMode.value === 'master' && currentStatus !== 'mastered') {
            verse.memorizationStatus = 'mastered'
            verse.masteredAt = new Date().toISOString()
            // Initialize spaced repetition fields when mastering
            if (!verse.nextReviewDate) {
              const tomorrow = new Date()
              tomorrow.setDate(tomorrow.getDate() + 1)
              verse.nextReviewDate = tomorrow.toISOString()
            }
            if (verse.reviewCount === undefined || verse.reviewCount === null) {
              verse.reviewCount = 0
            }
            if (!verse.easeFactor) {
              verse.easeFactor = 2.5
            }
            if (verse.interval === undefined || verse.interval === null) {
              verse.interval = 0
            }
            if (!verse.reviewHistory) {
              verse.reviewHistory = []
            }
            verse.lastModified = new Date().toISOString() // Track when verse was last modified
            saveVerses()
          }

          if (
            memorizationMode.value === 'master' &&
            verse.id === guidedOnboardingVerseId.value &&
            (guidedOnboardingStep.value === 'tap-verse' || guidedOnboardingStep.value === 'practice')
          ) {
            setGuidedOnboardingStep('review-tab', verse.id)
          }
        }
      }
      
      // Get the source state before clearing it
      const sourceState = memorizationSourceState.value
      
      // Clear source tracking
      memorizationSourceState.value = null
      
      // Reset memorization state
      memorizingVerse.value = null
      memorizationMode.value = null
      reviewWords.value = []
      typedLetter.value = ''
      reviewMistakes.value = 0
      
      // Navigate to source state — replace the memorization history entry so back button
      // returns to the screen before memorization, not back into the memorization flow
      if (sourceState) {
        if (sourceState.collectionId) {
          currentCollectionId.value = sourceState.collectionId
          replaceNavigationState({ view: 'collection', collectionId: sourceState.collectionId })
        } else if (sourceState.view === 'review-list') {
          currentCollectionId.value = null
          currentView.value = 'review-list'
          replaceNavigationState({ view: 'review-list' })
        } else if (sourceState.view === 'collections') {
          currentCollectionId.value = null
          currentView.value = 'collections'
          replaceNavigationState({ view: 'collections' })
        } else if (sourceState.view === 'stats') {
          currentCollectionId.value = null
          currentView.value = 'stats'
          replaceNavigationState({ view: 'stats' })
        } else {
          // Fallback
          currentCollectionId.value = null
          currentView.value = 'review-list'
          replaceNavigationState({ view: 'review-list' })
        }
      } else {
        // Fallback: use browser back if available, otherwise go to collections
        if (!isHandlingBackButton && window.history.length > 1) {
          window.history.back()
        } else {
          currentCollectionId.value = null
          currentView.value = 'collections'
          pushNavigationState({ view: 'collections' })
        }
      }
    }

    // Retry memorization (reset without saving)
    const retryMemorization = () => {
      if (memorizingVerse.value) {
        memorizationInstanceKey.value += 1 // Remount VersePracticeView so keyboard shows
        const verse = memorizingVerse.value
        const mode = memorizationMode.value
        if (mode === 'memorize') memorizeRetryCount.value += 1
        resetPracticeSequence(verse, mode, memorizeRetryCount.value)
        reviewMistakes.value = 0
        nextTick(() => {
          memorizationPracticeRef.value?.focusInput?.()
        })
      }
    }

    // Retry current review
    const retryReview = () => {
      if (reviewingVerse.value) {
        reviewInstanceKey.value += 1 // Remount VersePracticeView so keyboard shows (same as Next Verse)
        // Re-initialize current mode (so user stays in Learn/Memorize if they were in that mode)
        const mode = memorizationMode.value || 'master'
        switchReviewMode(mode)
      }
    }

    // Move to next verse for review
    const nextVerse = () => {
      console.log('[nextVerse] Called', {
        hasReviewingVerse: !!reviewingVerse.value,
        verseId: reviewingVerse.value?.id,
        verseReference: reviewingVerse.value?.reference
      })
      
      if (reviewingVerse.value) {
        // Save current review first (only if accuracy requirement is met and not already saved)
        const verse = verses.value.find(v => v.id === reviewingVerse.value.id)
        
        console.log('[nextVerse] Verse lookup', {
          found: !!verse,
          verseId: verse?.id,
          currentReviewSaved: currentReviewSaved.value,
          allWordsRevealed: allWordsRevealed.value,
          meetsAccuracyRequirement: meetsAccuracyRequirement.value,
          accuracy: accuracy.value,
          reviewMistakes: reviewMistakes.value,
          totalWords: totalPracticeUnitCount.value,
          lastReviewedBefore: verse?.lastReviewed
        })
        
        if (verse && !currentReviewSaved.value && allWordsRevealed.value && memorizationMode.value === 'master') {
          console.log('[nextVerse] Entering save block (fallback)')

          const totalWords = totalPracticeUnitCount.value
          const grade = firstAttemptGrade.value !== null ? firstAttemptGrade.value : calculateGrade(totalWords, reviewMistakes.value)
          const mistakes = firstAttemptMistakes.value !== null ? firstAttemptMistakes.value : reviewMistakes.value

          // Check if verse was already reviewed today
          const wasAlreadyReviewedToday = wasReviewedToday(verse)

          const newLastReviewed = new Date().toISOString()

          console.log('[nextVerse] Before update', {
            reviewCount: verse.reviewCount,
            lastReviewed: verse.lastReviewed,
            nextReviewDate: verse.nextReviewDate,
            interval: verse.interval,
            easeFactor: verse.easeFactor,
            wasAlreadyReviewedToday: wasAlreadyReviewedToday
          })

          // Only advance the spaced repetition schedule on the first review of the day
          if (!wasAlreadyReviewedToday) {
            const reviewData = calculateNextReviewDate(verse, grade, true)
            verse.reviewCount = (verse.reviewCount || 0) + 1
            verse.nextReviewDate = reviewData.nextReviewDate
            verse.easeFactor = reviewData.easeFactor
            verse.interval = reviewData.interval
          }

          // Always update tracking fields regardless of whether it was reviewed today
          const firstAttemptAccuracy = ((totalWords - mistakes) / totalWords * 100).toFixed(1)
          verse.lastReviewed = newLastReviewed
          verse.lastGrade = grade
          verse.lastAccuracy = firstAttemptAccuracy
          verse.lastModified = new Date().toISOString()

          // Track review history
          if (!verse.reviewHistory) verse.reviewHistory = []
          verse.reviewHistory.push({
            date: new Date().toISOString(),
            grade: grade,
            accuracy: parseFloat(firstAttemptAccuracy),
            mistakes: mistakes
          })
          
          console.log('[nextVerse] After update', {
            reviewCount: verse.reviewCount,
            lastReviewed: verse.lastReviewed,
            newLastReviewed: newLastReviewed,
            nextReviewDate: verse.nextReviewDate,
            interval: verse.interval,
            easeFactor: verse.easeFactor,
            lastGrade: verse.lastGrade,
            lastAccuracy: verse.lastAccuracy,
            reviewHistoryLength: verse.reviewHistory.length
          })
          
          currentReviewSaved.value = true // Mark as saved to prevent duplicate saves
          
          console.log('[nextVerse] Calling saveVerses()')
          saveVerses()
          
          // Verify after save
          const savedVerse = verses.value.find(v => v.id === verse.id)
          console.log('[nextVerse] After saveVerses()', {
            lastReviewed: savedVerse?.lastReviewed,
            matches: savedVerse?.lastReviewed === newLastReviewed
          })
          
          // Double-check localStorage directly
          setTimeout(() => {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
              try {
                const parsed = JSON.parse(stored)
                const storedVerse = parsed.find(v => v.id === verse.id)
                console.log('[nextVerse] localStorage verification (after 100ms)', {
                  found: !!storedVerse,
                  lastReviewed: storedVerse?.lastReviewed,
                  matches: storedVerse?.lastReviewed === newLastReviewed,
                  verseId: verse.id,
                  reference: verse.reference
                })
              } catch (e) {
                console.error('[nextVerse] Error parsing localStorage', e)
              }
            }
          }, 100)
        } else {
          console.log('[nextVerse] NOT saving - conditions not met', {
            hasVerse: !!verse,
            currentReviewSaved: currentReviewSaved.value,
            allWordsRevealed: allWordsRevealed.value,
            meetsAccuracyRequirement: meetsAccuracyRequirement.value
          })
        }
        
        // Find next verse in the source list
        let sourceVerses = null
        
        if (reviewSourceList.value && reviewSourceList.value.length > 0) {
          // Use the source list from where we came
          sourceVerses = reviewSourceList.value
        } else {
          // Fallback: use all verses due for review
          sourceVerses = verses.value.filter(v => isDueForReview(v))
        }
        
        if (sourceVerses.length > 0) {
          // Find current verse index in source list
          const currentIndex = sourceVerses.findIndex(v => v.id === reviewingVerse.value.id)
          
          if (currentIndex !== -1) {
            // Find next verse in the list
            const nextIndex = (currentIndex + 1) % sourceVerses.length
            startReview(sourceVerses[nextIndex])
          } else {
            // Current verse not in source list, go to first verse
            startReview(sourceVerses[0])
          }
        } else {
          // No more verses in source list, exit review
          console.log('[nextVerse] No more verses, calling exitReview()')
          exitReview()
        }
      } else {
        console.log('[nextVerse] No reviewingVerse.value, cannot proceed')
      }
    }

    // Exit review mode
    const exitReview = () => {
      stopSpeaking()
      console.log('[exitReview] Called', {
        hasReviewingVerse: !!reviewingVerse.value,
        verseId: reviewingVerse.value?.id,
        verseReference: reviewingVerse.value?.reference,
        currentReviewSaved: currentReviewSaved.value,
        allWordsRevealed: allWordsRevealed.value,
        meetsAccuracyRequirement: meetsAccuracyRequirement.value
      })
      
      // Only count as review (update spaced repetition) when in master mode
      // The allWordsRevealed watcher handles SRS save on first attempt, so this is a fallback safety net.
      if (reviewingVerse.value && !currentReviewSaved.value && allWordsRevealed.value && memorizationMode.value === 'master') {
        const verse = verses.value.find(v => v.id === reviewingVerse.value.id)
        console.log('[exitReview] Saving review (fallback)', {
          found: !!verse,
          verseId: verse?.id,
          lastReviewedBefore: verse?.lastReviewed
        })

        if (verse) {
          const totalWords = totalPracticeUnitCount.value
          const grade = firstAttemptGrade.value !== null ? firstAttemptGrade.value : calculateGrade(totalWords, reviewMistakes.value)
          const mistakes = firstAttemptMistakes.value !== null ? firstAttemptMistakes.value : reviewMistakes.value

          // Check if verse was already reviewed today
          const wasAlreadyReviewedToday = wasReviewedToday(verse)

          const newLastReviewed = new Date().toISOString()

          console.log('[exitReview] Before update', {
            reviewCount: verse.reviewCount,
            lastReviewed: verse.lastReviewed,
            nextReviewDate: verse.nextReviewDate,
            interval: verse.interval,
            wasAlreadyReviewedToday: wasAlreadyReviewedToday
          })

          // Only advance the spaced repetition schedule on the first review of the day
          if (!wasAlreadyReviewedToday) {
            const reviewData = calculateNextReviewDate(verse, grade, true)
            verse.reviewCount = (verse.reviewCount || 0) + 1
            verse.nextReviewDate = reviewData.nextReviewDate
            verse.easeFactor = reviewData.easeFactor
            verse.interval = reviewData.interval
          }

          // Always update tracking fields regardless of whether it was reviewed today
          const firstAttemptAccuracy = ((totalWords - mistakes) / totalWords * 100).toFixed(1)
          verse.lastReviewed = newLastReviewed
          verse.lastGrade = grade
          verse.lastAccuracy = firstAttemptAccuracy
          verse.lastModified = new Date().toISOString()

          // Track review history
          if (!verse.reviewHistory) verse.reviewHistory = []
          verse.reviewHistory.push({
            date: new Date().toISOString(),
            grade: grade,
            accuracy: parseFloat(firstAttemptAccuracy),
            mistakes: mistakes
          })
          
          console.log('[exitReview] After update', {
            reviewCount: verse.reviewCount,
            lastReviewed: verse.lastReviewed,
            newLastReviewed: newLastReviewed
          })
          
          currentReviewSaved.value = true // Mark as saved to prevent duplicate saves
          
          console.log('[exitReview] Calling saveVerses()')
          saveVerses()
          
          // Verify after save
          const savedVerse = verses.value.find(v => v.id === verse.id)
          console.log('[exitReview] After saveVerses()', {
            lastReviewed: savedVerse?.lastReviewed,
            matches: savedVerse?.lastReviewed === newLastReviewed
          })
        } else {
          console.log('[exitReview] NOT saving - conditions not met', {
            hasReviewingVerse: !!reviewingVerse.value,
            currentReviewSaved: currentReviewSaved.value,
            allWordsRevealed: allWordsRevealed.value,
            meetsAccuracyRequirement: meetsAccuracyRequirement.value
          })
        }
      } else {
        console.log('[exitReview] No review to save', {
          hasReviewingVerse: !!reviewingVerse.value,
          currentReviewSaved: currentReviewSaved.value
        })
      }
      
      // Navigate back to the source state (collection or review list)
      // This ensures back button always goes up the hierarchy, not to previous verses
      const sourceState = reviewSourceState.value
      
      // Clear source tracking
      reviewSourceList.value = null
      reviewSourceState.value = null
      
      // Reset review state
      reviewingVerse.value = null
      memorizationMode.value = null
      reviewWords.value = []
      typedLetter.value = ''
      reviewMistakes.value = 0
      currentReviewSaved.value = false
      
      // Navigate to source state
      if (sourceState) {
        if (sourceState.collectionId) {
          currentCollectionId.value = sourceState.collectionId
          pushNavigationState({ view: 'collection', collectionId: sourceState.collectionId })
        } else if (sourceState.view === 'review-list') {
          currentCollectionId.value = null
          currentView.value = 'review-list'
          pushNavigationState({ view: 'review-list' })
        } else if (sourceState.view === 'stats') {
          currentCollectionId.value = null
          currentView.value = 'stats'
          pushNavigationState({ view: 'stats' })
        } else {
          // Fallback
          currentCollectionId.value = null
          currentView.value = 'review-list'
          pushNavigationState({ view: 'review-list' })
        }
      } else {
        // Fallback: use browser back if available, otherwise go to review list
        if (!isHandlingBackButton && window.history.length > 1) {
          window.history.back()
        } else {
          currentCollectionId.value = null
          currentView.value = 'review-list'
          pushNavigationState({ view: 'review-list' })
        }
      }
    }

    // Focus input when clicking on verse text
    const focusInput = () => {
      if (memorizingVerse.value && memorizationPracticeRef.value) {
        memorizationPracticeRef.value.focusInput()
      } else if (reviewingVerse.value && reviewPracticeRef.value) {
        reviewPracticeRef.value.focusInput()
      }
    }

    // Scroll when the user reaches the first word of the last visible line.
    // Scrolls just enough to keep a couple of already-typed lines at the top.
    const scrollToCurrentWord = () => {
      const nextWordIndex = reviewWords.value.findIndex(w => !w.revealed)
      if (nextWordIndex === -1) return

      const practiceRef = memorizingVerse.value ? memorizationPracticeRef.value : reviewPracticeRef.value
      const container = practiceRef?.scrollContainer?.value ?? practiceRef?.scrollContainer
      if (!container) return

      nextTick(() => {
        requestAnimationFrame(() => {
          const allWords = container.querySelectorAll('[id^="practice-word-"]')
          if (!allWords.length || nextWordIndex >= allWords.length) return

          const wordEl = allWords[nextWordIndex]
          const containerRect = container.getBoundingClientRect()
          const wordRect = wordEl.getBoundingClientRect()

          // Group visible words into lines by their vertical position
          const lineTopThreshold = 4 // px tolerance for same-line grouping
          const lines = []
          let currentLineTop = null
          let currentLine = []

          for (const el of allWords) {
            const rect = el.getBoundingClientRect()
            if (currentLineTop === null || Math.abs(rect.top - currentLineTop) > lineTopThreshold) {
              if (currentLine.length) lines.push(currentLine)
              currentLine = [el]
              currentLineTop = rect.top
            } else {
              currentLine.push(el)
            }
          }
          if (currentLine.length) lines.push(currentLine)

          // Find the last line whose top is within the visible container area
          const visibleBottom = containerRect.bottom
          let lastVisibleLineIndex = -1
          for (let i = 0; i < lines.length; i++) {
            const lineTop = lines[i][0].getBoundingClientRect().top
            if (lineTop < visibleBottom) {
              lastVisibleLineIndex = i
            }
          }

          if (lastVisibleLineIndex < 0) return

          // Check if the current word is on the last visible line (or beyond)
          const lastVisibleLine = lines[lastVisibleLineIndex]
          const wordIsOnLastLine = lastVisibleLine.includes(wordEl)
          const wordIsBeyondView = wordRect.top >= visibleBottom

          if (!wordIsOnLastLine && !wordIsBeyondView) return

          // Only trigger on the first word of that line (or if beyond view)
          if (wordIsOnLastLine && lastVisibleLine[0] !== wordEl) return

          // Scroll so that 2 already-typed lines remain visible at the top.
          // Find the line the current word is on, then go back 2 lines.
          let currentWordLineIndex = lines.findIndex(line => line.includes(wordEl))
          if (currentWordLineIndex < 0) currentWordLineIndex = lines.length - 1

          const keepLines = 2
          const targetLineIndex = Math.max(0, currentWordLineIndex - keepLines)
          const targetEl = lines[targetLineIndex][0]
          const targetTop = targetEl.getBoundingClientRect().top - containerRect.top + container.scrollTop

          container.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'smooth'
          })
        })
      })
    }

    // Handle key press events
    const handleKeyPress = (event) => {
      // When review completion modal is open, Enter goes to next verse (keyboard-only flow)
      if (
        event.key === 'Enter' &&
        reviewingVerse.value &&
        allWordsRevealed.value &&
        meetsAccuracyRequirement.value
      ) {
        event.preventDefault()
        nextVerse()
        return
      }

      // Allow backspace, delete, arrow keys, etc.
      if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter'].includes(event.key)) {
        return
      }
      
      // For single character keys, manually update the value and check
      if (event.key.length === 1) {
        event.preventDefault()
        const letter = event.key.toLowerCase()
        typedLetter.value = letter
        checkLetter()
      }
    }

    // Check if typed letter matches next word's first letter
    const checkLetter = () => {
      if (!typedLetter.value || reviewWords.value.length === 0) return

      const letter = typedLetter.value.toLowerCase()
      
      // For memorization modes, find the next word that should be revealed
      // For review mode, find the first unrevealed word
      let nextWordIndex = -1
      
      if (memorizationMode.value) {
        // In memorization modes, find next word that needs to be revealed
        if (memorizationMode.value === 'learn') {
          // In learn mode, reveal words in order (all are visible but not revealed)
          nextWordIndex = reviewWords.value.findIndex(w => !w.revealed)
        } else if (memorizationMode.value === 'memorize') {
          // In memorize mode, type all words in order (both visible and hidden)
          nextWordIndex = reviewWords.value.findIndex(w => !w.revealed)
        } else if (memorizationMode.value === 'master') {
          // In master mode, reveal all words in order
          nextWordIndex = reviewWords.value.findIndex(w => !w.revealed)
        }
      } else {
        // Review mode: find first unrevealed word
        nextWordIndex = reviewWords.value.findIndex(w => !w.revealed)
      }
      
      if (nextWordIndex !== -1) {
        const nextWord = reviewWords.value[nextWordIndex]
        
        // Get the current required letter (for hyphenated words, this advances through the sequence)
        // If requiredLetters is not set, compute it from the word text
        let requiredLetters = nextWord.requiredLetters
        if (!requiredLetters || requiredLetters.length === 0) {
          requiredLetters = getRequiredLetters(nextWord.text)
          // Update the word object with the computed requiredLetters
          nextWord.requiredLetters = requiredLetters
          // Also compute and store parts and separators if not already set
          if (!nextWord.parts || !nextWord.separators) {
            const split = splitWordParts(nextWord.text)
            nextWord.parts = split.parts
            nextWord.separators = split.separators
          }
        }
        // Fallback to firstLetter if still no letters
        if (!requiredLetters || requiredLetters.length === 0) {
          requiredLetters = [nextWord.firstLetter || nextWord.text.charAt(0).toLowerCase()]
        }
        
        const currentLetterIndex = nextWord.typedLettersIndex || 0
        if (!Array.isArray(nextWord.incorrectLetterIndices)) {
          nextWord.incorrectLetterIndices = []
        }

        // Safety check: ensure we have a valid required letter
        if (currentLetterIndex >= requiredLetters.length) {
          // Already completed all letters, mark as revealed and move on
          nextWord.revealed = true
          nextWord.incorrect = nextWord.isReferenceUnit ? nextWord.incorrectLetterIndices.length > 0 : false
          if (memorizationMode.value === 'learn' || memorizationMode.value === 'memorize') {
            nextWord.visible = true
          }
          typedLetter.value = ''
          nextTick(() => {
            scrollToCurrentWord()
            focusInput()
          })
          return
        }
        
        const currentRequiredLetter = requiredLetters[currentLetterIndex]
        
        // Safety check: ensure currentRequiredLetter is valid
        if (!currentRequiredLetter) {
          // Fallback: mark word as revealed if we can't determine required letter
          nextWord.revealed = true
          nextWord.incorrect = nextWord.isReferenceUnit ? nextWord.incorrectLetterIndices.length > 0 : false
          typedLetter.value = ''
          return
        }
        
        // Check if the letter matches the current required letter (with fuzzy typing)
        if (isLetterMatch(letter, currentRequiredLetter)) {
          // Correct letter - advance to next letter in sequence
          nextWord.typedLettersIndex = currentLetterIndex + 1
          nextWord.incorrect = nextWord.isReferenceUnit ? nextWord.incorrectLetterIndices.length > 0 : false
          
          // Check if all required letters have been typed
          if (nextWord.typedLettersIndex >= requiredLetters.length) {
            // All letters typed - reveal the word normally
            nextWord.revealed = true
            nextWord.incorrect = nextWord.isReferenceUnit ? nextWord.incorrectLetterIndices.length > 0 : false
            if (memorizationMode.value === 'learn' || memorizationMode.value === 'memorize') {
              nextWord.visible = true // Make it visible in learn/memorize modes
            }
            typedLetter.value = ''
            
            // Auto-scroll to next word and focus input
            nextTick(() => {
              scrollToCurrentWord()
              focusInput()
            })
          } else {
            // More letters needed - clear input and wait for next letter
            typedLetter.value = ''
            
            // Auto-scroll to current word and focus input
            nextTick(() => {
              scrollToCurrentWord()
              focusInput()
            })
          }
        } else {
          // Reference units advance one character at a time even on mistakes,
          // so a wrong digit does not consume an entire multi-digit token.
          if (nextWord.isReferenceUnit) {
            nextWord.typedLettersIndex = currentLetterIndex + 1
            nextWord.incorrectLetterIndices.push(currentLetterIndex)
            nextWord.incorrect = true
            if (memorizationMode.value === 'learn' || memorizationMode.value === 'memorize') {
              nextWord.visible = true
            }
            if (nextWord.typedLettersIndex >= requiredLetters.length) {
              nextWord.revealed = true
            }
          } else {
            // Wrong letter (not correct and not adjacent) - reveal the word but mark it as incorrect
            nextWord.revealed = true
            nextWord.incorrect = true
            if (memorizationMode.value === 'learn' || memorizationMode.value === 'memorize') {
              nextWord.visible = true // Make it visible in learn/memorize modes
            }
          }
          reviewMistakes.value++
          typedLetter.value = ''

          // Vibrate on wrong keypress
          vibrate(50)

          // Auto-scroll to next word and focus input
          nextTick(() => {
            scrollToCurrentWord()
            focusInput()
          })
        }
        return
      }

      typedLetter.value = ''
    }

    // Sync functions
    const triggerSync = async (showFeedback = false) => {
      // Don't sync if already syncing or if no provider configured
      if (syncing.value) {
        console.log('[triggerSync] Already syncing, skipping')
        return
      }

      if (!isSyncConfigured()) {
        if (showFeedback) {
          syncError.value = 'Sync not configured. Please configure it in settings.'
          setTimeout(() => { syncError.value = null }, 5000)
        }
        console.log('[triggerSync] No sync provider configured, skipping')
        return
      }
      
      // Track which verse we're reviewing before sync (if any)
      const reviewingId = reviewingVerse.value?.id
      let reviewingVerseBeforeSync = null
      if (reviewingId) {
        reviewingVerseBeforeSync = verses.value.find(v => v.id === reviewingId)
        console.log('[triggerSync] Before sync - reviewing verse state', {
          id: reviewingVerseBeforeSync?.id,
          reference: reviewingVerseBeforeSync?.reference,
          lastReviewed: reviewingVerseBeforeSync?.lastReviewed,
          reviewCount: reviewingVerseBeforeSync?.reviewCount
        })
      }
      
      syncing.value = true
      syncError.value = null
      
      try {
        const result = await syncData(verses.value, collections.value)
        if (result.success) {
          // Update local data with merged data from sync
          if (result.verses) {
            console.log('[triggerSync] Sync complete - updating verses:', result.verses.length, 'local verses before:', verses.value.length)
            
            // Check if our reviewing verse was affected by merge
            if (reviewingId) {
              const mergedVerse = result.verses.find(v => v.id === reviewingId)
              console.log('[triggerSync] After merge - reviewing verse state', {
                id: mergedVerse?.id,
                reference: mergedVerse?.reference,
                lastReviewed: mergedVerse?.lastReviewed,
                reviewCount: mergedVerse?.reviewCount,
                lastReviewedChanged: mergedVerse?.lastReviewed !== reviewingVerseBeforeSync?.lastReviewed,
                lastReviewedOlder: mergedVerse?.lastReviewed && reviewingVerseBeforeSync?.lastReviewed && 
                  new Date(mergedVerse.lastReviewed) < new Date(reviewingVerseBeforeSync.lastReviewed)
              })
              
              // If merge overwrote our new lastReviewed with an older one, keep all local review fields
              // (merge chose remote incorrectly; we must preserve nextReviewDate, interval, etc.)
              if (mergedVerse && reviewingVerseBeforeSync && 
                  mergedVerse.lastReviewed && reviewingVerseBeforeSync.lastReviewed &&
                  new Date(mergedVerse.lastReviewed) < new Date(reviewingVerseBeforeSync.lastReviewed)) {
                console.warn('[triggerSync] WARNING: Merge overwrote newer review! Restoring all local review fields.', {
                  merged: mergedVerse.lastReviewed,
                  local: reviewingVerseBeforeSync.lastReviewed
                })
                mergedVerse.lastReviewed = reviewingVerseBeforeSync.lastReviewed
                mergedVerse.lastModified = reviewingVerseBeforeSync.lastModified || new Date().toISOString()
                mergedVerse.nextReviewDate = reviewingVerseBeforeSync.nextReviewDate
                mergedVerse.interval = reviewingVerseBeforeSync.interval
                mergedVerse.easeFactor = reviewingVerseBeforeSync.easeFactor
                mergedVerse.reviewCount = reviewingVerseBeforeSync.reviewCount
                if (reviewingVerseBeforeSync.lastGrade != null) mergedVerse.lastGrade = reviewingVerseBeforeSync.lastGrade
                if (reviewingVerseBeforeSync.lastAccuracy != null) mergedVerse.lastAccuracy = reviewingVerseBeforeSync.lastAccuracy
                if (reviewingVerseBeforeSync.reviewHistory?.length) mergedVerse.reviewHistory = reviewingVerseBeforeSync.reviewHistory
              }
            }
            
            // Log a sample of merged verses for debugging (especially those with review dates)
            if (result.verses.length > 0) {
              const versesWithReview = result.verses.filter(v => v.nextReviewDate)
              console.log(`[triggerSync] Verses with nextReviewDate: ${versesWithReview.length}`)
              if (versesWithReview.length > 0) {
                const sample = versesWithReview.slice(0, 3)
                sample.forEach(v => {
                  console.log(`[triggerSync] Merged verse ${v.id} (${v.reference}): nextReviewDate=${v.nextReviewDate}, interval=${v.interval}, lastModified=${v.lastModified}, lastReviewed=${v.lastReviewed}`)
                })
              }
            }
            // Update verses array - create new array reference for Vue reactivity
            verses.value = [...result.verses]
            localStorage.setItem(STORAGE_KEY, JSON.stringify(verses.value))
            
            // Verify the reviewing verse after update
            if (reviewingId) {
              const finalVerse = verses.value.find(v => v.id === reviewingId)
              console.log('[triggerSync] Final state - reviewing verse', {
                id: finalVerse?.id,
                lastReviewed: finalVerse?.lastReviewed,
                reviewCount: finalVerse?.reviewCount
              })
            }
            
            // Force Vue to update by using nextTick and verify the update
            await nextTick()
            
            // Verify specific verses were updated correctly - check all verses with review dates
            if (result.verses.length > 0) {
              const versesWithReview = result.verses.filter(v => v.nextReviewDate)
              console.log(`[App] Verifying ${versesWithReview.length} verses with nextReviewDate`)
              
              // Check the reviewing verse specifically if it exists
              if (reviewingId) {
                const reviewingVerseAfterSync = verses.value.find(v => v.id === reviewingId)
                const mergedVerse = result.verses.find(v => v.id === reviewingId)
                console.log('[triggerSync] Reviewing verse after sync update', {
                  id: reviewingVerseAfterSync?.id,
                  reference: reviewingVerseAfterSync?.reference,
                  lastReviewed: reviewingVerseAfterSync?.lastReviewed,
                  mergedLastReviewed: mergedVerse?.lastReviewed,
                  matches: reviewingVerseAfterSync?.lastReviewed === mergedVerse?.lastReviewed
                })
              }
              
              let allMatch = true
              versesWithReview.slice(0, 5).forEach(testVerse => {
                const localVerse = verses.value.find(v => v.id === testVerse.id)
                if (localVerse) {
                  const matches = localVerse.nextReviewDate === testVerse.nextReviewDate
                  if (!matches) {
                    allMatch = false
                    console.log(`[App] MISMATCH - Verse ${testVerse.id} (${testVerse.reference}):`)
                    console.log(`[App]   Expected: ${testVerse.nextReviewDate}`)
                    console.log(`[App]   Actual: ${localVerse.nextReviewDate}`)
                  }
                }
              })
              
              // Double-check by reading from localStorage - specifically check reviewing verse
              const stored = localStorage.getItem(STORAGE_KEY)
              if (stored) {
                const storedVerses = JSON.parse(stored)
                
                // Check reviewing verse specifically
                if (reviewingId) {
                  const storedReviewingVerse = storedVerses.find(v => v.id === reviewingId)
                  const inMemoryVerse = verses.value.find(v => v.id === reviewingId)
                  console.log('[triggerSync] localStorage verification for reviewing verse', {
                    id: reviewingId,
                    storedLastReviewed: storedReviewingVerse?.lastReviewed,
                    inMemoryLastReviewed: inMemoryVerse?.lastReviewed,
                    matches: storedReviewingVerse?.lastReviewed === inMemoryVerse?.lastReviewed
                  })
                }
                
                const storedVerse = storedVerses.find(v => v.id === versesWithReview[0]?.id)
                if (storedVerse && versesWithReview[0]) {
                  const localStorageMatch = storedVerse.nextReviewDate === versesWithReview[0].nextReviewDate
                  console.log(`[App] localStorage matches: ${localStorageMatch}`)
                  if (!localStorageMatch) {
                    console.log(`[App] localStorage mismatch - Expected: ${versesWithReview[0].nextReviewDate}, Got: ${storedVerse.nextReviewDate}`)
                  }
                }
              }
              
              if (allMatch) {
                console.log('[App] ✓ All verified verses match correctly')
              }
            }
            console.log('[App] Verses updated and saved to localStorage')
          }
          if (result.collections) {
            collections.value = result.collections
            localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections.value))
          }
          if (result.appSettings) {
            appSettings.value = { ...result.appSettings }
          }
          
          if (showFeedback) {
            showToast('Sync complete')
          }
        } else {
          // Sync failed
          const errorMsg = result.error || 'Sync failed'
          console.warn('Sync failed:', errorMsg)
          if (showFeedback) {
            syncError.value = errorMsg
            setTimeout(() => { syncError.value = null }, 5000)
          }
        }
      } catch (error) {
        // Sync failed
        const errorMsg = error.message || 'Sync error occurred'
        console.error('Sync error:', error)
        if (showFeedback) {
          syncError.value = errorMsg
          setTimeout(() => { syncError.value = null }, 5000)
        }
      } finally {
        syncing.value = false
      }
    }

    // Manual sync (with user feedback)
    const manualSync = () => {
      triggerSync(true)
    }

    const manualSyncFromDrawer = () => {
      closeDrawer()
      manualSync()
    }

    const closePracticeSettings = () => {
      showPracticeSettings.value = false
    }

    const openPracticeSettings = () => {
      closeSettingsMenu()
      closeDrawer()
      showPracticeSettings.value = true
    }

    const updateRequireReferenceTyping = (enabled) => {
      saveAppSettingsLocally({
        ...appSettings.value,
        requireReferenceTyping: enabled
      })
    }

    // Close settings modal
    const closeSettings = () => {
      showSettings.value = false
    }

    // Callback when sync settings are saved
    const onSyncSettingsSaved = () => {
      // Bump reactive trigger so hasSyncConfigured recomputes
      syncConfigVersion.value++
      // Trigger sync after saving settings
      setTimeout(() => {
        triggerSync(false)
      }, 500)
    }

    // Open settings menu
    const toggleSettingsMenu = () => {
      showSettingsMenu.value = !showSettingsMenu.value
    }

    // Close settings menu
    const closeSettingsMenu = () => {
      showSettingsMenu.value = false
    }

    // Navigation drawer
    const openDrawer = async () => {
      if (drawerHideTimeoutId) {
        clearTimeout(drawerHideTimeoutId)
        drawerHideTimeoutId = null
      }

      drawerVisible.value = true
      drawerOpen.value = false
      await nextTick()
      requestAnimationFrame(() => {
        drawerOpen.value = true
      })
    }

    const toggleDrawer = () => {
      if (drawerVisible.value && drawerOpen.value) {
        closeDrawer()
        return
      }

      openDrawer()
    }

    const closeDrawer = () => {
      drawerOpen.value = false

      if (drawerHideTimeoutId) {
        clearTimeout(drawerHideTimeoutId)
      }

      drawerHideTimeoutId = setTimeout(() => {
        drawerVisible.value = false
        drawerHideTimeoutId = null
      }, 300)
    }

    // Open sync settings from menu
    const openSyncSettings = () => {
      closeSettingsMenu()
      closeDrawer()
      showSettings.value = true
    }

    // Open backup/import modal from menu
    const openBackupImport = () => {
      closeSettingsMenu()
      closeDrawer()
      showBackupImport.value = true
    }

    // Close backup/import modal
    const closeBackupImport = () => {
      showBackupImport.value = false
    }

    const openAbout = () => {
      closeSettingsMenu()
      closeDrawer()
      window.location.assign(buildAboutUrl(getCurrentAppUrl()))
    }

    // Backup all data
    const backupAllData = () => {
      try {
        const webdavProvider = getProvider('webdav')
        const gdriveProvider = getProvider('gdrive')
        const backupData = {
          verses: verses.value,
          collections: collections.value,
          settings: {
            appSettings: appSettings.value,
            appSettingsLastModified: getAppSettingsRecord().appSettingsLastModified,
            activeProvider: getActiveProviderId(),
            webdav: webdavProvider ? webdavProvider.getSettings() : null,
            gdrive: gdriveProvider ? gdriveProvider.getSettings() : null
          },
          backedUpAt: new Date().toISOString(),
          version: '2.1'
        }

        const jsonStr = JSON.stringify(backupData, null, 2)
        const blob = new Blob([jsonStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        
        const dateStr = new Date().toISOString().split('T')[0]
        const filename = `rum1n8-backup-${dateStr}.json`
        
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        // Save backup timestamp
        const timestamp = new Date().toISOString()
        localStorage.setItem('rum1n8-last-backup', timestamp)
        lastBackupTimestamp.value = timestamp
      } catch (error) {
        console.error('Error backing up data:', error)
        alert('Failed to backup data. Please try again.')
      }
    }

    // Import from backup file
    const importFromBackup = async (file) => {
      try {
        const text = await file.text()
        const backupData = JSON.parse(text)

        // Validate backup structure
        if (!backupData.verses || !Array.isArray(backupData.verses)) {
          alert('Invalid backup file: missing verses array')
          return
        }
        if (!backupData.collections || !Array.isArray(backupData.collections)) {
          alert('Invalid backup file: missing collections array')
          return
        }

        // Show confirmation
        const confirmed = confirm(
          'This will replace all your current data with the backup data. ' +
          'This action cannot be undone. Are you sure you want to continue?'
        )

        if (!confirmed) {
          return
        }

        // Replace data
        verses.value = backupData.verses
        collections.value = backupData.collections

        // Restore settings if present
        if (backupData.settings) {
          if (backupData.version === '2.0' || backupData.version === '2.1' || backupData.settings.activeProvider !== undefined) {
            // v2.0 format: nested provider settings
            const { activeProvider, webdav, gdrive, appSettings: importedAppSettings, appSettingsLastModified } = backupData.settings
            const webdavProvider = getProvider('webdav')
            const gdriveProvider = getProvider('gdrive')
            if (webdav && webdavProvider) webdavProvider.saveSettings(webdav)
            if (gdrive && gdriveProvider) gdriveProvider.saveSettings(gdrive)
            if (activeProvider) {
              setActiveProviderId(activeProvider)
            }
            const savedSettings = saveAppSettingsRecord({
              appSettings: importedAppSettings || {},
              appSettingsLastModified
            })
            appSettings.value = { ...savedSettings.appSettings }
          } else {
            // v1.0 format: flat WebDAV settings object
            const webdavProvider = getProvider('webdav')
            if (webdavProvider) webdavProvider.saveSettings(backupData.settings)
            setActiveProviderId('webdav')
            const savedSettings = saveAppSettingsRecord({
              appSettings: {},
              appSettingsLastModified: null
            })
            appSettings.value = { ...savedSettings.appSettings }
          }
        } else {
          const savedSettings = saveAppSettingsRecord({
            appSettings: {},
            appSettingsLastModified: null
          })
          appSettings.value = { ...savedSettings.appSettings }
        }

        // Save to localStorage
        saveVerses()
        saveCollections()

        // Update last backup timestamp if present
        if (backupData.backedUpAt) {
          localStorage.setItem('rum1n8-last-backup', backupData.backedUpAt)
          lastBackupTimestamp.value = backupData.backedUpAt
        }

        // Close modal
        closeBackupImport()

        alert('Data imported successfully!')
      } catch (error) {
        console.error('Error importing backup:', error)
        alert('Failed to import backup. Please check that the file is valid.')
      }
    }

    // Handle file input for import
    const handleBackupFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        importFromBackup(file)
        // Reset input
        event.target.value = ''
      }
    }

    // Get display text for a word (shows partial text for hyphenated words)
    const getWordDisplayText = (word) => {
      // If word is fully revealed, show full text
      if (word.revealed) {
        return word.text
      }
      
      // If word has required letters and is partially typed, show partial text
      if (word.requiredLetters && word.requiredLetters.length > 1) {
        const typedLettersIndex = word.typedLettersIndex || 0
        if (typedLettersIndex > 0) {
          return getPartialWordText(word)
        }
      }
      
      // Otherwise return empty string (will be replaced with underscores)
      return ''
    }

    // Helper function to check verse data (can be called from console)
    window.checkVerseData = (verseIdOrReference) => {
      const verse = typeof verseIdOrReference === 'string' && verseIdOrReference.includes('-')
        ? verses.value.find(v => v.id === verseIdOrReference)
        : verses.value.find(v => v.reference.toLowerCase().includes(verseIdOrReference.toLowerCase()))
      
      if (!verse) {
        console.log('Verse not found:', verseIdOrReference)
        return null
      }
      
      const stored = localStorage.getItem(STORAGE_KEY)
      let storedVerse = null
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          storedVerse = parsed.find(v => v.id === verse.id)
        } catch (e) {
          console.error('Error parsing localStorage', e)
        }
      }
      
      const result = {
        id: verse.id,
        reference: verse.reference,
        inMemory: {
          lastReviewed: verse.lastReviewed,
          lastModified: verse.lastModified,
          reviewCount: verse.reviewCount,
          interval: verse.interval,
          nextReviewDate: verse.nextReviewDate
        },
        inLocalStorage: storedVerse ? {
          lastReviewed: storedVerse.lastReviewed,
          lastModified: storedVerse.lastModified,
          reviewCount: storedVerse.reviewCount,
          interval: storedVerse.interval,
          nextReviewDate: storedVerse.nextReviewDate
        } : null,
        matches: storedVerse ? verse.lastReviewed === storedVerse.lastReviewed : false
      }
      
      console.log('=== Verse Data Check ===')
      console.log('Reference:', result.reference)
      console.log('ID:', result.id)
      console.log('In Memory - lastReviewed:', result.inMemory.lastReviewed)
      console.log('In Memory - lastModified:', result.inMemory.lastModified)
      console.log('In Memory - reviewCount:', result.inMemory.reviewCount)
      if (result.inLocalStorage) {
        console.log('In localStorage - lastReviewed:', result.inLocalStorage.lastReviewed)
        console.log('In localStorage - lastModified:', result.inLocalStorage.lastModified)
        console.log('In localStorage - reviewCount:', result.inLocalStorage.reviewCount)
        console.log('Values match:', result.matches)
        if (!result.matches) {
          console.warn('⚠️ MISMATCH: Memory and localStorage have different lastReviewed values!')
        }
      } else {
        console.warn('⚠️ Verse not found in localStorage!')
      }
      console.log('Full object:', result)
      return result
    }
    
    const handleWindowScroll = (event) => {
      const target = event?.target
      const scrollTop = target === document || target === window || !target
        ? (window.scrollY || document.documentElement.scrollTop || 0)
        : (target.scrollTop || 0)
      isScrolled.value = scrollTop > 4
    }

    // Load verses on mount
    onMounted(async () => {
      loadCollections()
      loadVerses()
      appSettings.value = getAppSettings()
      migrateProviderSetting()

      // Load last backup timestamp
      const stored = localStorage.getItem('rum1n8-last-backup')
      if (stored) {
        lastBackupTimestamp.value = stored
      }

      // Initialize history state tracking for back button
      initializeHistory()
      syncLocalUiState()
      markAppOpened(getCurrentAppUrl())

      document.addEventListener('scroll', handleWindowScroll, { passive: true, capture: true })
      handleWindowScroll()

      // Perform initial sync on app load
      await triggerSync()
    })

    // Cleanup event listener on unmount
    onBeforeUnmount(() => {
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('scroll', handleWindowScroll, { capture: true })
    })

    return {
      verses,
      showForm,
      newVerse,
      addVerse,
      closeForm,
      reviewingVerse,
      reviewWords,
      typedLetter,
      reviewInput,
      revealedCount,
      allWordsRevealed,
      guidedOnboardingStep,
      guidedOnboardingVerseId,
      shouldShowHeroOnboarding,
      shouldShowVerseOnboardingCallout,
      shouldShowReviewTabCallout,
      shouldShowReviewOnboardingTip,
      shouldShowGuidedOnboardingScrim,
      shouldShowPracticeModesHint,
      sortedVerses,
      dueVersesCount,
      totalVerseCount,
      hasNoCollectionVerses,
      hasToLearnVerses,
      isDueForReview,
      getDaysUntilReview,
      getTimeUntilReview,
      splitReference,
      reviewMistakes,
      memorizingVerse,
      memorizationMode,
      getMemorizationStatus,
      getNextMemorizationMode,
      handleVerseClick,
      isVerseExpanded,
      toggleVerseExpanded,
      beforeVerseExpand,
      enterVerseExpand,
      afterVerseExpand,
      beforeVerseCollapse,
      leaveVerseCollapse,
      afterVerseCollapse,
      startMemorization,
      canSwitchToMode,
      switchToMemorizationMode,
      switchReviewMode,
      canSwitchToModeForReview,
      advanceToNextMode,
      exitMemorization,
      retryMemorization,
      startReview,
      retryReview,
      nextVerse,
      exitReview,
      focusInput,
      reviewInstanceKey,
      handleKeyPress,
      checkLetter,
      getWordDisplayText,
      getPartialWordText,
      getRemainingPartText,
      isPartiallyTyped,
      accuracy,
      meetsAccuracyRequirement,
      reviewingVerseNextReviewLabel,
      collections,
      currentCollectionId,
      showCollectionForm,
      showEditVerseForm,
      editingVerse,
      newCollection,
      addCollection,
      closeCollectionForm,
      handleFabClick,
      openNewVerse,
      openHeroVerseModal,
      openNewCollection,
      openImportCSV,
      fabMenuOpen,
      isScrolled,
      deleteCollection,
      startEditCollection,
      saveEditedCollection,
      closeEditCollectionForm,
      handleDeleteCollectionFromModal,
      showEditCollectionForm,
      editingCollection,
      getCollectionName,
      getCollectionVerseCount,
      getCollectionDueCount,
      viewCollection,
      viewAllVerses,
      currentView,
      reviewSortedVerses,
      navigateToReviewList,
      navigateToCollections,
      navigateToStats,
      clearSearch,
      openSearch,
      searchActive,
      searchInputRef,
      searchQuery,
      searchResults,
      highlightText,
      isDark,
      currentStreak,
      masteredCount,
      masteredOverTimeData,
      dailyActivityData,
      masteredChartData,
      lineChartOptions,
      dailyBarChartData,
      barChartOptions,
      chartColors,
      yAxisLabels,
      dailyActivityScrollRef,
      setVerseCardRef,
      copyVerse,
      speakVerse,
      stopSpeaking,
      isSpeaking,
      toastState,
      startEditVerse,
      saveEditedVerse,
      closeEditVerseForm,
      handleDeleteVerseFromModal,
      deleteVerse,
      showPracticeSettings,
      showSettings,
      appSettings,
      showSettingsMenu,
      drawerVisible,
      drawerOpen,
      toggleDrawer,
      closeDrawer,
      showBackupImport,
      isDev,
      closePracticeSettings,
      closeSettings,
      toggleSettingsMenu,
      closeSettingsMenu,
      skipGuidedOnboarding,
      dismissReviewOnboardingTip,
      dismissPracticeModesHint,
      openPracticeSettings,
      openSyncSettings,
      onSyncSettingsSaved,
      openBackupImport,
      closeBackupImport,
      openAbout,
      backupAllData,
      importFromBackup,
      handleBackupFileSelect,
      getTimeSinceLastBackup,
      hasSyncConfigured,
      shouldShowBackupReminder,
      backupFileInput,
      manualSync,
      manualSyncFromDrawer,
      updateRequireReferenceTyping,
      syncing,
      syncError,
      shareSuccess,
      showImportCSV,
      csvFileInput,
      csvPreview,
      csvImportStatus,
      csvImportFromCollectionsScreen,
      csvImportTargetCollectionIds,
      importingCSV,
      handleCSVFileSelect,
      handleCSVPaste,
      csvPastedText,
      importCSVVerses,
      closeImportCSV,
      importingVerse,
      importError,
      importErrorShowLink,
      importVerseContent,
      isPWAInstalled,
      showIOSModal,
      triggerInstall,
      closeIOSModal,
      memorizationPracticeRef,
      memorizationInstanceKey,
      reviewPracticeRef,
      reviewTextContainer,
      totalPracticeUnitCount,
      appVersion
    }
  }
}
</script>

<style scoped>
.result-tray-enter-active,
.result-tray-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.result-tray-enter-from,
.result-tray-leave-to {
  transform: translateY(100%);
}
.result-overlay-enter-active,
.result-overlay-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.result-overlay-enter-from,
.result-overlay-leave-to {
  opacity: 0;
}
</style>
