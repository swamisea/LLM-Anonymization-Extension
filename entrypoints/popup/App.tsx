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
      p="0"
      m="0"
    >
      <PIICounter />
    </Paper>
  );
}

export default App;
