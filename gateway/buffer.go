package main

import (
	"bufio"
	"encoding/json"
	"os"
	"sync"
)

// Buffer is the queue between the OPC UA poller and the uploader. While the
// backend is unreachable readings pile up here (capped; oldest dropped) and are
// saved to disk periodically and on shutdown, so a restart doesn't lose them.
type Buffer struct {
	mu      sync.Mutex
	items   []Reading
	max     int
	nextSeq uint64
	dropped int64
	file    string
	dirty   bool
}

func newBuffer(file string, max int) *Buffer {
	return &Buffer{file: file, max: max, nextSeq: 1}
}

func (b *Buffer) Add(rs []Reading) {
	if len(rs) == 0 {
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	for i := range rs {
		rs[i].seq = b.nextSeq
		b.nextSeq++
	}
	b.items = append(b.items, rs...)
	if over := len(b.items) - b.max; over > 0 {
		b.items = append([]Reading(nil), b.items[over:]...)
		b.dropped += int64(over)
	}
	b.dirty = true
}

// Peek returns a copy of up to n of the oldest readings.
func (b *Buffer) Peek(n int) []Reading {
	b.mu.Lock()
	defer b.mu.Unlock()
	if n > len(b.items) {
		n = len(b.items)
	}
	return append([]Reading(nil), b.items[:n]...)
}

// RemoveThrough drops every reading up to and including seq (safe even if
// overflow already dropped some of them).
func (b *Buffer) RemoveThrough(seq uint64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	i := 0
	for i < len(b.items) && b.items[i].seq <= seq {
		i++
	}
	if i > 0 {
		b.items = append([]Reading(nil), b.items[i:]...)
		b.dirty = true
	}
}

func (b *Buffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.items)
}

func (b *Buffer) Dropped() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.dropped
}

// Save writes pending readings to disk (or removes the file when empty).
func (b *Buffer) Save() error {
	b.mu.Lock()
	if !b.dirty {
		b.mu.Unlock()
		return nil
	}
	items := append([]Reading(nil), b.items...)
	b.dirty = false
	b.mu.Unlock()

	if len(items) == 0 {
		err := os.Remove(b.file)
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	tmp := b.file + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	w := bufio.NewWriter(f)
	enc := json.NewEncoder(w)
	for _, r := range items {
		if err := enc.Encode(r); err != nil {
			f.Close()
			return err
		}
	}
	if err := w.Flush(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, b.file)
}

// Load restores readings saved by a previous run.
func (b *Buffer) Load() (int, error) {
	f, err := os.Open(b.file)
	if os.IsNotExist(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	defer f.Close()
	var rs []Reading
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	for sc.Scan() {
		var r Reading
		if json.Unmarshal(sc.Bytes(), &r) == nil && r.MachineID != "" {
			rs = append(rs, r)
		}
	}
	b.Add(rs)
	return len(rs), sc.Err()
}
