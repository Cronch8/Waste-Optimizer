# Pump Station Optimization Platform

A full-stack system for simulating, visualizing, and optimizing
wastewater pump station behavior using machine learning and
mathematical optimization techniques.

## Overview

This project explores how smarter pump control can reduce energy
costs at large wastewater treatment facilities. Using real
operational data, a simulator, and an interactive frontend, the
system demonstrates how optimization algorithms and ML models
can schedule pump activity more efficiently.

At the Blominmäki pump station alone, weekly operating costs can
exceed €13,000. Our prototype shows that smarter scheduling
can cut that by roughly €2,000 per week — about **17% savings**.

### Visualizer Frontend

A Vite + React + TypeScript interface that shows:

* Pump networks and container levels
* Pump states and switching events
* Energy usage and comparisons
* Interactive dashboards

## Getting Started

### Requirements

* Node 18+
* Python 3.10+
* Bun (optional)

### Install

```bash
npm install
# or
bun install
```

### Run Frontend

```bash
npm run dev
```

### Run Simulator

From the `src/sim` directory:

```bash
python3 main.py
```

Use other scripts for experiments.

## How Optimization Works

### Greedy Algorithm

Calculates pump activity decisions based on immediate energy cost and system state.
Produces significant savings even without global optimization.

### Mixed Integer Linear Programming

Computes the globally optimal pump schedule over a given horizon.
This requires more compute but provides the theoretical best solution.

### Machine Learning Path

The long-term goal is to train a neural model on MILP-generated optimal schedules.
With multi-year data, the model can:

* Predict near-optimal decisions instantly
* Reduce compute requirements
* Adapt to varying load conditions

## Vision

With more data and compute resources, this platform can
evolve into a fully automated, energy‑aware control system
for wastewater infrastructure across Finland — and beyond.

