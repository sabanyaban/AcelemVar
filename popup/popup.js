class SpeedReader {
  constructor() {
    this.text = "";
    this.words = [];
    this.sentences = [];
    this.currentWordIndex = 0;
    this.running = false;
    this.wpm = 400;
    this.timer = null;
    this.speed = this.wpmToMs(this.wpm);
    
    this.initializeElements();
    this.setupEventListeners();
    
    // Background script ile bağlantı kur
    this.port = browser.runtime.connect({ name: "popup" });
    
    // Background'dan gelen mesajları dinle
    this.port.onMessage.addListener((msg) => {
      if (msg.command === "setText" && msg.text) {
        this.setText(msg.text);
      }
    });
    
    // Başlangıç metnini iste
    this.port.postMessage({ command: "getInitialText" });
  }
  
  initializeElements() {
    // DOM elementlerini seç
    this.wordPrefix = document.querySelector('.word-prefix');
    this.wordFocus = document.querySelector('.word-focus');
    this.wordSuffix = document.querySelector('.word-suffix');
    // ... diğer elementler ...
  }
  
  setupEventListeners() {
    // Event listener'ları ekle
    document.getElementById('startButton').addEventListener('click', () => this.toggleReading());
    document.getElementById('getTextButton').addEventListener('click', async () => {
      // Aktif sekmeden seçili metni al
      const tabs = await browser.tabs.query({active: true, currentWindow: true});
      const text = await browser.tabs.sendMessage(tabs[0].id, {command: "getSelection"});
      if (text) {
        this.setText(text);
      }
    });
    
    // Hız ayarı için slider
    const speedSlider = document.getElementById('speed');
    speedSlider.addEventListener('input', (e) => {
      this.wpm = parseInt(e.target.value);
      this.speed = this.wpmToMs(this.wpm);
      document.getElementById('speed-label').textContent = 
        `${this.wpm} kelime/dakika`;
      
      // Okuma devam ediyorsa yeni hızı uygula
      if (this.running) {
        clearInterval(this.timer);
        this.timer = setInterval(() => this.displayNextWord(), this.speed);
      }
    });

    // 10 kelime geri gitme butonu
    document.getElementById('back10').addEventListener('click', () => this.goBack10Words());

    // Progress slider için event listener
    document.getElementById('progress').addEventListener('input', (e) => {
      this.currentWordIndex = parseInt(e.target.value);
      this.displayWord(this.words[this.currentWordIndex]);
      document.getElementById('progress-label').textContent = 
        `${this.currentWordIndex + 1}/${this.words.length}`;
      
      // Cümleyi güncelle
      const current = this.findCurrentSentence();
      if (current) {
        const sentenceDisplay = document.querySelector('.sentence-display');
        sentenceDisplay.innerHTML = this.highlightCurrentWord(current);
        
        // Vurgulanan kelimeyi bul ve görünür yap
        const highlightedWord = sentenceDisplay.querySelector('span');
        if (highlightedWord) {
          const wordTop = highlightedWord.offsetTop;
          const containerHeight = sentenceDisplay.clientHeight;
          const wordHeight = highlightedWord.clientHeight;
          
          sentenceDisplay.scrollTop = wordTop - (containerHeight / 2) + (wordHeight / 2);
        }
      }
    });

    // Klavye kısayolları
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();  // Sayfanın kaymasını engelle
        this.toggleReading();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.goBack10Words();
      } else if (e.code === 'ArrowDown') {  // Yeni kısayol
        e.preventDefault();
        this.goToSentenceStart();
      }
    });
  }
  
  async getSelectedText() {
    // Aktif sekmeden seçili metni al
    const tabs = await browser.tabs.query({active: true, currentWindow: true});
    const text = await browser.tabs.sendMessage(tabs[0].id, {command: "getSelection"});
    if (text) {
      this.setText(text);
    }
  }
  
  setText(text) {
    this.text = text;
    this.words = text.split(/\s+/);
    this.sentences = this.splitIntoSentences(text);
    this.currentWordIndex = 0;
    
    // Progress slider'ı güncelle
    const progressSlider = document.getElementById('progress');
    progressSlider.max = this.words.length - 1;
    progressSlider.value = 0;
    
    // Progress label'ı güncelle
    document.getElementById('progress-label').textContent = `0/${this.words.length}`;
    
    // İlk kelimeyi ve cümleyi göster
    this.displayWord(this.words[0]);
    
    // İlk cümleyi göster
    const current = this.findCurrentSentence();
    if (current) {
      const sentenceDisplay = document.querySelector('.sentence-display');
      sentenceDisplay.innerHTML = this.highlightCurrentWord(current);
      
      // Vurgulanan kelimeyi bul ve görünür yap
      const highlightedWord = sentenceDisplay.querySelector('span');
      if (highlightedWord) {
        const wordTop = highlightedWord.offsetTop;
        const containerHeight = sentenceDisplay.clientHeight;
        const wordHeight = highlightedWord.clientHeight;
        
        sentenceDisplay.scrollTop = wordTop - (containerHeight / 2) + (wordHeight / 2);
      }
    }
  }
  
  splitIntoSentences(text) {
    // Önce tüm metni kelimelere ayır ve her kelimenin cümle sonu olup olmadığını işaretle
    const words = text.split(/\s+/);
    const sentences = [];
    let currentSentence = [];
    
    for (const word of words) {
      currentSentence.push(word);
      
      // Eğer kelime cümle sonu işaretlerinden biriyle bitiyorsa
      if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
        sentences.push({
          text: currentSentence.join(' '),
          startIndex: sentences.length === 0 ? 0 : 
            sentences[sentences.length - 1].startIndex + sentences[sentences.length - 1].wordCount,
          wordCount: currentSentence.length
        });
        currentSentence = [];
      }
    }
    
    // Eğer son cümle nokta ile bitmiyorsa onu da ekle
    if (currentSentence.length > 0) {
      sentences.push({
        text: currentSentence.join(' '),
        startIndex: sentences.length === 0 ? 0 : 
          sentences[sentences.length - 1].startIndex + sentences[sentences.length - 1].wordCount,
        wordCount: currentSentence.length
      });
    }
    
    return sentences;
  }
  
  displayWord(word) {
    if (!word) return;
    
    const length = word.length;
    const focusIndex = Math.floor(length / 2);
    
    this.wordPrefix.textContent = word.slice(0, focusIndex);
    this.wordFocus.textContent = word[focusIndex];
    this.wordSuffix.textContent = word.slice(focusIndex + 1);

    // Odak harfinin genişliğini hesapla
    const focusWidth = this.wordFocus.getBoundingClientRect().width;
    
    // Prefix ve suffix için minimum boşluk bırak
    const minPadding = 2;
    this.wordFocus.style.marginLeft = `${minPadding}px`;
    this.wordFocus.style.marginRight = `${minPadding}px`;
  }
  
  wpmToMs(wpm) {
    return Math.floor(60000 / wpm); // 60000 ms = 1 dakika
  }
  
  toggleReading() {
    if (!this.running) {
      if (!this.words.length) {
        alert("Lütfen önce bir metin yükleyin.");
        return;
      }
      this.startReading();
    } else {
      this.stopReading();
    }
  }
  
  startReading() {
    this.running = true;
    document.getElementById('startButton').textContent = "⏸";
    this.timer = setInterval(() => this.displayNextWord(), this.speed);
  }
  
  stopReading() {
    this.running = false;
    document.getElementById('startButton').textContent = "▶";
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  
  updateSentenceDisplay(current) {
    if (!current) return;
    
    const sentenceDisplay = document.querySelector('.sentence-display');
    sentenceDisplay.innerHTML = this.highlightCurrentWord(current);
    
    const highlightedWord = sentenceDisplay.querySelector('span');
    if (highlightedWord) {
      const wordTop = highlightedWord.offsetTop;
      const containerHeight = sentenceDisplay.clientHeight;
      const wordHeight = highlightedWord.clientHeight;
      sentenceDisplay.scrollTop = wordTop - (containerHeight / 2) + (wordHeight / 2);
    }
  }

  updateProgress() {
    const progressSlider = document.getElementById('progress');
    progressSlider.value = this.currentWordIndex;
    document.getElementById('progress-label').textContent = 
      `${this.currentWordIndex + 1}/${this.words.length}`;
  }

  displayNextWord() {
    if (this.currentWordIndex < this.words.length) {
      const word = this.words[this.currentWordIndex];
      this.displayWord(word);
      this.updateProgress();
      this.updateSentenceDisplay(this.findCurrentSentence());
      
      if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
        clearInterval(this.timer);
        setTimeout(() => {
          this.currentWordIndex++;
          if (this.running) {
            this.timer = setInterval(() => this.displayNextWord(), this.speed);
          }
        }, this.speed * 2);
      } else {
        this.currentWordIndex++;
      }
    } else {
      this.stopReading();
    }
  }
  
  findCurrentSentence() {
    for (const sentence of this.sentences) {
      if (this.currentWordIndex >= sentence.startIndex && 
          this.currentWordIndex < sentence.startIndex + sentence.wordCount) {
        return sentence;
      }
    }
    return this.sentences[this.sentences.length - 1];
  }
  
  highlightCurrentWord(sentence) {
    const words = sentence.text.split(/\s+/);
    
    // Cümle içindeki pozisyonu bul
    const positionInSentence = this.currentWordIndex - sentence.startIndex;
    
    // Kelimeleri döngüye al ve sadece doğru pozisyondaki kelimeyi vurgula
    return words.map((word, index) => {
      if (index === positionInSentence) {
        return `<span style="color: #fffff1">${word}</span>`;
      }
      return word;
    }).join(' ');
  }

  goBack10Words() {
    if (this.words.length === 0) return;
    
    const newIndex = Math.max(0, this.currentWordIndex - 10);
    if (newIndex === this.currentWordIndex) return;
    
    this.currentWordIndex = newIndex;
    this.displayWord(this.words[this.currentWordIndex]);
    this.updateProgress();
    this.updateSentenceDisplay(this.findCurrentSentence());
  }

  goToSentenceStart() {
    if (!this.words.length) return;
    
    const current = this.findCurrentSentence();
    this.currentWordIndex = current.startIndex;
    
    this.displayWord(this.words[this.currentWordIndex]);
    this.updateProgress();
    this.updateSentenceDisplay(current);
  }
}

// Content script ile iletişim için listener
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "getSelection") {
    return Promise.resolve(window.getSelection().toString());
  }
});

// SpeedReader'ı başlat
const reader = new SpeedReader(); 