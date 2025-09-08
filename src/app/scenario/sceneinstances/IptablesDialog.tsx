"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
} from "@mui/material";
import useSWR from "swr";

type Rule = {
  id: string;
  table: string;
  chain: string;
  args: string[];
  raw: string;
  protocol?: string | null;
  dport?: string | null;
  jump?: string | null;
  to_destination?: string | null;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  let data: any = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    const msg = (data && (data.message || data.error)) || `请求失败 (${r.status})`;
    throw new Error(msg);
  }
  return data;
};

interface IptablesDialogProps {
  open: boolean;
  onClose: () => void;
}

const IptablesDialog: React.FC<IptablesDialogProps> = ({ open, onClose }) => {
  const [table, setTable] = React.useState<string>("nat");
  const { data, error, isLoading, mutate } = useSWR<{ table: string; rules: Rule[] }>(
    open ? `/back/api/scenariosinstances/iptables?table=${encodeURIComponent(table)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const onChangeTable = (e: SelectChangeEvent<string>) => {
    setTable(e.target.value);
  };

  const handleDelete = async (rule: Rule) => {
    if (!confirm(`确认删除规则?\n${rule.raw}`)) return;
    const res = await fetch(`/back/api/scenariosinstances/iptables`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: rule.table, chain: rule.chain, args: rule.args }),
    });
    if (!res.ok && res.status !== 207) {
      const txt = await res.text();
      alert(`删除失败: ${txt}`);
    }
    await mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>iptables 规则管理</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2} alignItems="center" mb={2} mt={1}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="iptables-table-select">表 (table)</InputLabel>
            <Select
              labelId="iptables-table-select"
              label="表 (table)"
              value={table}
              onChange={onChangeTable}
            >
              <MenuItem value="nat">nat</MenuItem>
              <MenuItem value="filter">filter</MenuItem>
              <MenuItem value="mangle">mangle</MenuItem>
              <MenuItem value="raw">raw</MenuItem>
              <MenuItem value="security">security</MenuItem>
            </Select>
          </FormControl>
          <Button onClick={() => mutate()} variant="outlined">刷新</Button>
          {isLoading && <CircularProgress size={20} />}
          {error && <Typography color="error">{String(error)}</Typography>}
        </Stack>

        {!isLoading && Array.isArray(data?.rules) && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>链 (chain)</TableCell>
                <TableCell>协议</TableCell>
                <TableCell>端口 (--dport)</TableCell>
                <TableCell>动作 (-j)</TableCell>
                <TableCell>目标 (--to-destination)</TableCell>
                <TableCell>原始规则</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.rules ?? []).map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.chain}</TableCell>
                  <TableCell>{r.protocol || ""}</TableCell>
                  <TableCell>{r.dport || ""}</TableCell>
                  <TableCell>{r.jump || ""}</TableCell>
                  <TableCell>{r.to_destination || ""}</TableCell>
                  <TableCell>
                    <code style={{ whiteSpace: "pre-wrap" }}>{r.raw}</code>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" color="error" variant="outlined" onClick={() => handleDelete(r)}>
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default IptablesDialog;

