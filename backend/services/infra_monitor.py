from __future__ import annotations

import json
import re
import subprocess
from typing import Optional

from backend.models import (
    DatastoreStatus,
    FolderVmCount,
    HostStatus,
    InfraSnapshot,
    InfraState,
)


class InfraMonitor:
    def __init__(self, *, java_cmd: str, jar_path: str, timeout: int):
        self._java = java_cmd
        self._jar = jar_path
        self._timeout = timeout

    def _run_vmtools(self, *args: str) -> subprocess.CompletedProcess:
        cmd = [self._java, "-jar", self._jar, *args]
        return subprocess.run(cmd, capture_output=True, text=True, timeout=self._timeout)

    def get_datastore_usage(self, datastore: str, host: str) -> DatastoreStatus:
        result = self._run_vmtools("getDatastoreUsagePercentage", datastore, host)
        if result.returncode != 0:
            raise RuntimeError(
                f"VmTools getDatastoreUsagePercentage failed (exit {result.returncode}): {result.stderr.strip()}"
            )
        usage = int(result.stdout.strip())
        return DatastoreStatus(name=datastore, usage_percent=usage)

    def get_host_info(self, host: str) -> HostStatus:
        result = self._run_vmtools("getHostInfo", host)
        output = result.stderr + result.stdout
        cpu_match = re.search(r"CPU\s*-\s*(\d+)%", output)
        mem_match = re.search(r"Memory\s*-\s*(\d+)%", output)
        if not cpu_match or not mem_match:
            raise RuntimeError(
                f"Could not parse host info for {host}. Output: {output[:200]}"
            )
        return HostStatus(
            ip=host,
            cpu_percent=int(cpu_match.group(1)),
            memory_percent=int(mem_match.group(1)),
        )

    def count_vms_in_folder(self, folder: str, datacenter: str) -> int:
        result = self._run_vmtools("listVmsInFolder", folder, datacenter, ".+")
        count = 0
        for line in result.stderr.splitlines():
            if line.startswith("vm="):
                count += 1
        return count

    def get_folder_vm_states(self, folder: str, datacenter: str) -> FolderVmCount:
        """Get per-VM power state for all VMs in a folder using getVmState."""
        result = self._run_vmtools("getVmState", "--folder", folder, datacenter, ".+")
        try:
            vms = json.loads(result.stdout.strip())
            total = len(vms)
            powered_on = sum(1 for vm in vms if vm.get("powerState") == "poweredOn")
            return FolderVmCount(folder=folder, count=total, powered_on=powered_on)
        except (json.JSONDecodeError, ValueError):
            count = self.count_vms_in_folder(folder, datacenter)
            return FolderVmCount(folder=folder, count=count, powered_on=0)

    def get_all_datastores(self, datastores: list[str], host: str) -> list[DatastoreStatus]:
        results = []
        for ds in datastores:
            try:
                results.append(self.get_datastore_usage(ds, host))
            except RuntimeError:
                results.append(DatastoreStatus(name=ds, usage_percent=-1))
        return results

    def get_all_hosts(self, hosts: list[str]) -> list[HostStatus]:
        results = []
        for h in hosts:
            try:
                results.append(self.get_host_info(h))
            except RuntimeError:
                results.append(HostStatus(ip=h, cpu_percent=-1, memory_percent=-1))
        return results

    def get_all_vm_counts(self, folders: list[str], datacenter: str) -> list[FolderVmCount]:
        results = []
        for folder in folders:
            try:
                results.append(self.get_folder_vm_states(folder, datacenter))
            except (RuntimeError, subprocess.TimeoutExpired):
                results.append(FolderVmCount(folder=folder, count=-1, powered_on=0))
        return results

    @staticmethod
    def calculate_cluster_usage(datastores: list[DatastoreStatus]) -> float:
        valid = [ds for ds in datastores if ds.usage_percent >= 0]
        if not valid:
            return 0.0
        return sum(ds.usage_percent for ds in valid) / len(valid)

    @staticmethod
    def calculate_infra_state(
        *,
        storage_percent: float,
        max_cpu_percent: int,
        thresholds: dict,
    ) -> InfraState:
        storage_thresholds = thresholds["storage"]
        cpu_thresholds = thresholds["cpu"]

        storage_state = InfraState.READY
        if storage_percent >= storage_thresholds["constrained_below"]:
            storage_state = InfraState.SATURATED
        elif storage_percent >= storage_thresholds["ready_below"]:
            storage_state = InfraState.CONSTRAINED

        cpu_state = InfraState.READY
        if max_cpu_percent >= cpu_thresholds["constrained_below"]:
            cpu_state = InfraState.SATURATED
        elif max_cpu_percent >= cpu_thresholds["ready_below"]:
            cpu_state = InfraState.CONSTRAINED

        severity = {InfraState.READY: 0, InfraState.CONSTRAINED: 1, InfraState.SATURATED: 2}
        return max(storage_state, cpu_state, key=lambda s: severity[s])

    def fetch_full_snapshot(
        self,
        *,
        datastores: list[str],
        datastore_host: str,
        hosts: list[str],
        vm_folders: list[str],
        datacenter: str,
        thresholds: dict,
    ) -> InfraSnapshot:
        ds_statuses = self.get_all_datastores(datastores, datastore_host)
        host_statuses = self.get_all_hosts(hosts)
        vm_counts = self.get_all_vm_counts(vm_folders, datacenter)

        cluster_usage = self.calculate_cluster_usage(ds_statuses)
        max_cpu = max((h.cpu_percent for h in host_statuses if h.cpu_percent >= 0), default=0)
        state = self.calculate_infra_state(
            storage_percent=cluster_usage, max_cpu_percent=max_cpu, thresholds=thresholds,
        )

        return InfraSnapshot(
            state=state,
            datastores=ds_statuses,
            cluster_usage_percent=round(cluster_usage, 1),
            hosts=host_statuses,
            vm_counts=vm_counts,
        )
