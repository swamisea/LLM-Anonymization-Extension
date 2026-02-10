import { useState } from 'react';
import reactLogo from '@/assets/react.svg';
import wxtLogo from '/wxt.svg';
import './App.css';
import PIICounter from './components/PIICounter';
import { Paper } from '@mantine/core';

function App() {
  return (
    <Paper
      w={350}
      h={450}
      radius="lg"
      shadow="xl"
      withBorder
      p="xl"
      style={{ overflow: 'hidden' }}
      bg=""
    >
      <PIICounter />
    </Paper>
  );
}

export default App;
